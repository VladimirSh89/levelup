#!/usr/bin/env bash
# Level Up Barbershop — production deploy to levelup.codebridgestudio.com
# Pipeline: build → rsync public + api + prisma → migrate → passenger restart → smoke
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
fail() { echo -e "${RED}✘ $*${NC}"; exit 1; }
info() { echo -e "${YELLOW}▶ $*${NC}"; }

if [[ ! -f "$REPO_ROOT/.env.deploy" ]]; then
  fail "Create .env.deploy from .env.deploy.example"
fi
# shellcheck disable=SC1091
set -a; source "$REPO_ROOT/.env.deploy"; set +a

: "${PROD_SSH_TARGET:?}"
: "${PROD_PUBLIC_DIR:?}"
: "${PROD_API_DIR:?}"
: "${PROD_URL:?}"

SKIP_TESTS=false
DRY_RUN=false
for arg in "$@"; do
  [[ "$arg" == "--skip-tests" ]] && SKIP_TESTS=true
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

info "Building client + server…"
npm run build || fail "Build failed"
ok "Build complete"

if [[ "$SKIP_TESTS" != "true" ]]; then
  info "Running unit tests…"
  npm run test:unit || fail "Unit tests failed"
  ok "Unit tests passed"
fi

RSYNC_FLAGS=(-az --delete)
SSH_OPTS=(-o BatchMode=yes)
if [[ -n "${PROD_SSH_KEY_PATH:-}" ]]; then
  KEY="${PROD_SSH_KEY_PATH/#\~/$HOME}"
  [[ -f "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
fi

remote() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] ssh $PROD_SSH_TARGET $*"
    return 0
  fi
  ssh "${SSH_OPTS[@]}" "$PROD_SSH_TARGET" "$@"
}

rsync_to() {
  local src="$1" dest="$2"
  shift 2 || true
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] rsync $src → $PROD_SSH_TARGET:$dest"
    return 0
  fi
  if [[ "$#" -gt 0 ]]; then
    rsync "${RSYNC_FLAGS[@]}" "$@" -e "ssh ${SSH_OPTS[*]}" "$src" "$PROD_SSH_TARGET:$dest"
  else
    rsync "${RSYNC_FLAGS[@]}" -e "ssh ${SSH_OPTS[*]}" "$src" "$PROD_SSH_TARGET:$dest"
  fi
}

info "Ensuring remote directories…"
remote "mkdir -p '$PROD_PUBLIC_DIR' '$PROD_API_DIR/dist' '$PROD_API_DIR/prisma' '$PROD_API_DIR/tmp' '$PROD_API_DIR/uploads'"

info "Uploading frontend (client/dist → document root)…"
# Preserve cPanel/Passenger .htaccess if present
rsync_to "client/dist/" "$PROD_PUBLIC_DIR/" --exclude '.htaccess' --exclude 'cgi-bin' --exclude '.well-known' --exclude 'api'

info "Writing SPA .htaccess (keeps Passenger /api block if already injected)…"
if [[ "$DRY_RUN" != "true" ]]; then
  # Merge: if Passenger block exists, keep it; ensure SPA fallback
  remote "bash -s" <<'REMOTE_HT'
set -euo pipefail
DOC=/home/codensgo/levelup.codebridgestudio.com
HT="$DOC/.htaccess"
PASSENGER=""
if [[ -f "$HT" ]] && grep -q 'PASSENGER CONFIGURATION BEGIN' "$HT"; then
  PASSENGER=$(sed -n '/PASSENGER CONFIGURATION BEGIN/,/PASSENGER CONFIGURATION END/p' "$HT")
  ENVBLOCK=""
  if grep -q 'CLOUDLINUX ENV VARS' "$HT"; then
    ENVBLOCK=$(sed -n '/CLOUDLINUX ENV VARS CONFIGURATION BEGIN/,/CLOUDLINUX ENV VARS CONFIGURATION END/p' "$HT")
  fi
fi
cat > "$HT" <<'EOF'
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
__PASSENGER__
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
__ENVBLOCK__

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Let Passenger handle /api (do not rewrite those to index.html)
  RewriteRule ^api(?:/|$) - [L]

  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule . - [L]
  RewriteRule . /index.html [L]
</IfModule>
EOF
  # Inject preserved passenger block (or a sensible default)
  if [[ -n "${PASSENGER:-}" ]]; then
    # PASSENGER var already includes BEGIN/END markers from sed — strip duplicates by rewriting file properly
    {
      echo "$PASSENGER"
      [[ -n "${ENVBLOCK:-}" ]] && echo "$ENVBLOCK"
      cat <<'EOF'

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteRule ^api(?:/|$) - [L]

  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule . - [L]
  RewriteRule . /index.html [L]
</IfModule>
EOF
    } > "$HT"
  else
    cat > "$HT" <<'EOF'
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/codensgo/levelup-api"
PassengerBaseURI "/api"
PassengerNodejs "/home/codensgo/nodevenv/levelup-api/20/bin/node"
PassengerAppType node
PassengerStartupFile dist/index.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteRule ^api(?:/|$) - [L]

  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule . - [L]
  RewriteRule . /index.html [L]
</IfModule>
EOF
  fi
  echo "Wrote $HT"
  head -30 "$HT"
REMOTE_HT
fi

info "Uploading API (server/dist + package files + prisma)…"
rsync_to "server/dist/" "$PROD_API_DIR/dist/"
rsync_to "server/package.json" "$PROD_API_DIR/package.json"
[[ -f server/package-lock.json ]] && rsync_to "server/package-lock.json" "$PROD_API_DIR/package-lock.json"
rsync_to "prisma/" "$PROD_API_DIR/prisma/"

info "Remote: light finalize (generate + single API process; no hanging db push)…"
if [[ "$DRY_RUN" != "true" ]]; then
  remote "bash -s" <<REMOTE
set -euo pipefail
cd "$PROD_API_DIR"
export PATH="/home/codensgo/nodevenv/levelup-api/20/bin:\$PATH"
hash -r

# --- Free NPROC: kill leftovers from prior deploys ---
pkill -f "/home/codensgo/levelup-api/dist/index.js" 2>/dev/null || true
pkill -f "/home/codensgo/levelup-api/.*prisma" 2>/dev/null || true
sleep 1

# Prefer TCP for MySQL (avoids Prisma hang on localhost→socket)
if [[ -f .env ]] && grep -q 'DATABASE_URL=.*@localhost:' .env; then
  sed -i 's/@localhost:/@127.0.0.1:/g' .env
  echo 'Normalized DATABASE_URL host to 127.0.0.1'
fi

# Flat API root: generate client into ./node_modules (not ./server/node_modules)
sed -i 's|output        = "../server/node_modules/.prisma/client"|output        = "../node_modules/.prisma/client"|' prisma/schema.prisma || true

# Install only when lockfile changed / no modules (npm ci is NPROC-heavy)
if [[ ! -d node_modules/@prisma/client ]] || [[ package-lock.json -nt node_modules ]]; then
  echo 'Installing deps…'
  if [[ -f package-lock.json ]]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi
else
  echo 'Skipping npm ci (node_modules up to date)'
fi

# Hard timeout — never leave hung prisma eating NPROC
timeout 60s npm exec -- prisma generate --schema ./prisma/schema.prisma

# Schema sync with timeout (skip if it stalls; use SQL/migrations offline instead)
if ! timeout 45s npm exec -- prisma db push --schema ./prisma/schema.prisma --skip-generate --accept-data-loss; then
  echo 'WARN: prisma db push timed out or failed — continuing (check schema manually)'
fi

# Optional seed: SEED_ON_DEPLOY=1 npm run deploy:prod
if [[ "\${SEED_ON_DEPLOY:-}" == "1" ]] && [[ -f dist/seed.js ]]; then
  echo 'Seeding catalog + Shaxzod (no clients)…'
  timeout 60s env SEED_PURGE_CLIENTS=1 node dist/seed.js || echo 'WARN: seed failed'
fi

mkdir -p tmp
touch tmp/restart.txt

# Exactly one API process
pkill -f "/home/codensgo/levelup-api/dist/index.js" 2>/dev/null || true
sleep 1
set -a; [[ -f .env ]] && source .env; set +a
nohup /home/codensgo/nodevenv/levelup-api/20/bin/node dist/index.js >> stdout.log 2>> stderr.log &
sleep 2
# Ensure we did not spawn duplicates
COUNT=\$(pgrep -f "/home/codensgo/levelup-api/dist/index.js" | wc -l | tr -d ' ')
echo "API process count: \$COUNT"
curl -sfS --max-time 5 "http://127.0.0.1:\${PORT:-3002}/api/health" >/dev/null && echo "API healthy on :\${PORT:-3002}"
REMOTE
else
  echo "[DRY-RUN] remote light finalize"
fi
ok "Remote finalize done"

info "Smoke: $PROD_URL/api/health"
if [[ "$DRY_RUN" != "true" ]]; then
  sleep 3
  curl -sfS --max-time 20 "$PROD_URL/api/health" && echo || fail "Health check failed — check cPanel Node app Restart + stderr.log"
  curl -sfS --max-time 15 -o /dev/null -w "home %{http_code}\n" "$PROD_URL/" || fail "Home page check failed"
fi
ok "Deployed → $PROD_URL"

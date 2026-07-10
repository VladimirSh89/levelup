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

info "Remote: npm install + prisma generate + db push + restart…"
if [[ "$DRY_RUN" != "true" ]]; then
  remote "bash -s" <<REMOTE
set -euo pipefail
cd "$PROD_API_DIR"
# CloudLinux Node.js selector venv
export PATH="/home/codensgo/nodevenv/levelup-api/20/bin:\$PATH"
hash -r
node -v
npm -v
if [[ -f package-lock.json ]]; then npm ci --omit=dev; else npm install --omit=dev; fi
npm exec -- prisma generate --schema ./prisma/schema.prisma
npm exec -- prisma db push --schema ./prisma/schema.prisma --skip-generate
# Seed once if empty (admin missing)
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.user.findFirst({where:{role:'admin'}}).then(u=>{
  if(!u){ console.log('SEED_NEEDED'); process.exit(42); }
  console.log('Admin exists:', u.email); process.exit(0);
}).catch(e=>{ console.error(e); process.exit(1); }).finally(()=>p.\$disconnect());
" || {
  code=\$?
  if [[ \$code -eq 42 ]]; then
    echo 'Seeding database…'
    if [[ -f dist/seed.js ]]; then node dist/seed.js; else echo 'No dist/seed.js — seed manually later'; fi
  else
    exit \$code
  fi
}
mkdir -p tmp
touch tmp/restart.txt
# Keep a port-bound Node process (codebridge-style) — Passenger alone is flaky for /api on this host
export PATH="/home/codensgo/nodevenv/levelup-api/20/bin:\$PATH"
pkill -f "/home/codensgo/levelup-api/dist/index.js" 2>/dev/null || true
sleep 1
set -a; [[ -f .env ]] && source .env; set +a
nohup node dist/index.js >> stdout.log 2>> stderr.log &
sleep 2
curl -sfS --max-time 5 "http://127.0.0.1:\${PORT:-3002}/api/health" >/dev/null && echo "API healthy on :\${PORT:-3002}"
REMOTE
else
  echo "[DRY-RUN] remote npm/prisma/restart"
fi
ok "Remote finalize done"

info "Smoke: $PROD_URL/api/health"
if [[ "$DRY_RUN" != "true" ]]; then
  sleep 3
  curl -sfS --max-time 20 "$PROD_URL/api/health" && echo || fail "Health check failed — check cPanel Node app Restart + stderr.log"
  curl -sfS --max-time 15 -o /dev/null -w "home %{http_code}\n" "$PROD_URL/" || fail "Home page check failed"
fi
ok "Deployed → $PROD_URL"

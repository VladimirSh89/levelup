#!/usr/bin/env bash
# Quick pre-deploy sanity checks
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f .env.deploy ]]; then
  echo "Missing .env.deploy — copy from .env.deploy.example"
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.deploy; set +a

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
required="${REQUIRED_DEPLOY_BRANCH:-main}"
if [[ "$branch" != "$required" ]] && [[ "${ALLOW_DIRTY_ON_DEPLOY:-0}" != "1" ]]; then
  echo "On branch '$branch' (expected '$required'). Set ALLOW_DIRTY_ON_DEPLOY=1 to override."
  exit 1
fi

if [[ -n $(git status --porcelain 2>/dev/null) ]] && [[ "${ALLOW_DIRTY_ON_DEPLOY:-0}" != "1" ]]; then
  echo "Working tree is dirty. Commit first or set ALLOW_DIRTY_ON_DEPLOY=1."
  exit 1
fi

echo "Pre-deploy OK (branch=$branch, target=${PROD_SSH_TARGET:-?}, url=${PROD_URL:-?})"

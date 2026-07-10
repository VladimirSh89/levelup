#!/usr/bin/env bash
set -euo pipefail
BASE="${PROD_BASE_URL:-${PROD_URL:-https://levelup.codebridgestudio.com}}"
echo "Smoke against $BASE"
curl -sfS --max-time "${SMOKE_TEST_TIMEOUT:-30}" "$BASE/api/health" | head -c 200
echo
curl -sfS --max-time "${SMOKE_TEST_TIMEOUT:-30}" -o /dev/null -w "home %{http_code}\n" "$BASE/"
echo "Smoke OK"

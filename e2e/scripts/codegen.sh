#!/usr/bin/env bash
# Load .env.e2e and open Playwright codegen against the configured host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$E2E_ROOT"

ENV_FILE="$E2E_ROOT/.env.e2e"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${E2E_BASE_URL:-}" ]]; then
  echo "E2E_BASE_URL is not set. Copy .env.e2e.example to .env.e2e and configure it." >&2
  exit 1
fi

# Usage: ./scripts/codegen.sh [path]
#   ./scripts/codegen.sh           → E2E_BASE_URL/
#   ./scripts/codegen.sh /login    → E2E_BASE_URL/login
PATH_SUFFIX="${1:-/}"
TARGET="${E2E_BASE_URL%/}${PATH_SUFFIX}"

echo "Opening Playwright codegen → ${TARGET}"
exec npx playwright codegen "$TARGET" --ignore-https-errors

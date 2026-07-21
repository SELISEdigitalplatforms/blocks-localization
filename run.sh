#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "SCRIPT_DIR: $SCRIPT_DIR"
cd "$SCRIPT_DIR"

E2E_DIR="$SCRIPT_DIR/e2e"

usage() {
cat <<EOF
Usage: $0 [OPTION]

With no option: build the client app, then run the .NET server.

Options:
  -b,  --backend    Run the .NET server only (no client build)
  -te, --test-e2e   End-to-end tests (e2e/: playwright)
  -h,  --help       Show help
EOF
exit 1
}

build_client() {
  echo "Building client app..."
  (cd client && npm run build)
}

run_server() {
  echo "Running .NET server..."
  (cd server/Api && dotnet run)
}

# Playwright reads e2e/.env.e2e for the target host and credentials. Against a
# remote host set E2E_NO_WEBSERVER=1 there, or Playwright will try to boot a
# local API via `run.sh -b` and wait for it.
test_e2e() {
  echo "Running E2E tests..."

  if [ ! -f "$E2E_DIR/.env.e2e" ]; then
    echo "Missing $E2E_DIR/.env.e2e — copy .env.e2e.example and set E2E_BASE_URL + credentials."
    exit 1
  fi

  if [ ! -d "$E2E_DIR/node_modules" ]; then
    echo "Installing e2e dependencies..."
    (cd "$E2E_DIR" && npm install)
  fi

  (cd "$E2E_DIR" && npx playwright install --no-shell chromium)
  (cd "$E2E_DIR" && npm run test)
}

if [ $# -eq 0 ]; then
  build_client
  run_server
  exit 0
fi

case "$1" in

  -b|--backend)
    run_server
    ;;

  -te|--test-e2e)
    test_e2e
    ;;

  -h|--help)
    usage
    ;;

  *)
    usage
    ;;

esac

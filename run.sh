#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "SCRIPT_DIR: $SCRIPT_DIR"
cd "$SCRIPT_DIR"

E2E_DIR="$SCRIPT_DIR/e2e"
CLIENT_DIR="$SCRIPT_DIR/client"
API_PORT=5000

# Same pattern as blocks-os: paths come from the shell, never hardcoded here
export LOCALIZATION_SSL_CERT="${LOCALIZATION_SSL_CERT:-}"
export LOCALIZATION_SSL_KEY="${LOCALIZATION_SSL_KEY:-}"

usage() {
cat <<EOF
Usage: $0 [OPTION]

With no option: build the client app, then run the .NET server.

Options:
  -b,  --backend    Run the .NET server only (no client build)
  -f,  --frontend   Run frontend Vite dev server
  -te, --test-e2e   End-to-end tests (e2e/: playwright)
  -h,  --help       Show help
EOF
exit 1
}

build_client() {
  echo "Building client app..."
  (cd client && npm run build)
}

# HTTPS is driven by machine env vars LOCALIZATION_SSL_CERT / LOCALIZATION_SSL_KEY.
# Both set + both files present -> HTTPS on $API_PORT with mkcert PEM; otherwise -> HTTP.
configure_backend_tls() {
  if [ -n "${LOCALIZATION_SSL_CERT:-}" ] && [ -n "${LOCALIZATION_SSL_KEY:-}" ] \
     && [ -f "$LOCALIZATION_SSL_CERT" ] && [ -f "$LOCALIZATION_SSL_KEY" ]; then
    export Kestrel__Certificates__Default__Path="$LOCALIZATION_SSL_CERT"
    export Kestrel__Certificates__Default__KeyPath="$LOCALIZATION_SSL_KEY"
    export ASPNETCORE_URLS="https://0.0.0.0:$API_PORT"
    echo "Backend TLS: HTTPS on $API_PORT (mkcert PEM)"
  else
    export ASPNETCORE_URLS="http://0.0.0.0:$API_PORT"
    echo "Backend TLS: LOCALIZATION_SSL_CERT / LOCALIZATION_SSL_KEY not set/found — HTTP on $API_PORT"
  fi
}

run_server() {
  configure_backend_tls
  echo "Running .NET server..."
  # --urls overrides launchSettings applicationUrl (required for correct TLS bind)
  (cd server/Api && dotnet run -- --urls "$ASPNETCORE_URLS")
}

run_frontend() {
  echo "Starting frontend..."
  (cd "$CLIENT_DIR" && npm run dev)
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

  -f|--frontend)
    run_frontend
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

# Blocks Localization — End-to-End Tests (Playwright)

E2E tests that drive the real app through the browser, including the dev-iam
login redirect flow.

## One-time setup

1. **Configure env** — copy the template and fill in your values:

   ```bash
   cd e2e
   cp .env.e2e.example .env.e2e
   ```

   Set `E2E_USERNAME` and `E2E_PASSWORD`. `.env.e2e` is gitignored — never
   commit real credentials.

2. **Install** Playwright + the browser:

   ```bash
   cd e2e
   npm install
   npx playwright install chromium
   ```

   `./run.sh -te` does both of these for you on first run.

## Run

From the repo root:

```bash
./run.sh -te
```

or from `e2e/`:

```bash
npm test
```

### Other run modes

```bash
npm run test:headed   # watch it in a real browser
npm run test:ui       # Playwright UI mode
npm run report        # open the last HTML report
```

## Two target modes

### Remote dev (default)

```
E2E_BASE_URL=https://dev-localization.blocksdevelopers.com
E2E_NO_WEBSERVER=1
```

Nothing is built or started locally — the tests hit the deployed dev host.
`E2E_NO_WEBSERVER=1` is **required** here; without it Playwright tries to boot a
local API via `run.sh -b` and hangs waiting for it.

You will see this on every remote run, and it is correct:

```
[e2e] index.html not found at .../server/Api/wwwroot/index.html — skipping BLOCKS_LOCALIZATION_BASE_URL patch.
```

There is no local `wwwroot` build to patch, so `global-setup.ts` skips itself.

### Local build

Build the client and run the .NET server:

```bash
./run.sh          # client build + dotnet run
```

The API listens on **http://localhost:5000** (`server/Api/Properties/launchSettings.json`).
This repo's run scripts do **not** configure TLS — there are no SSL/cert env
vars to set, and the local server is plain HTTP.

Then point the tests at it:

```
E2E_BASE_URL=http://localhost:5000
# leave E2E_NO_WEBSERVER unset
```

With `E2E_NO_WEBSERVER` unset, Playwright starts `run.sh -b` itself (server
only, no client rebuild), reusing an already-running server if one is listening.
`global-setup.ts` then rewrites `BLOCKS_LOCALIZATION_BASE_URL` in the served
`index.html` so the SPA calls the local API instead of the remote dev host.

## Runtime config

`client/index.html` carries `window.__BLOCKS_ENV__` with placeholder tokens that
`server/Api/Program.cs` replaces at startup from the DB-backed `FrontendRuntime`
config section. The key this suite cares about is
**`__BLOCKS_LOCALIZATION_BASE_URL__`** / `FrontendRuntime__BLOCKS_LOCALIZATION_BASE_URL`.

## Knobs in `.env.e2e`

| Variable | Effect |
|---|---|
| `E2E_BASE_URL` | Host under test. No default — a missing value fails loudly. |
| `E2E_USERNAME` / `E2E_PASSWORD` | Dev-IAM test account (captcha is disabled on dev). |
| `E2E_NO_WEBSERVER=1` | Don't auto-start the app. Required for a remote `E2E_BASE_URL`. |
| `E2E_PAUSE_MS` | How long the browser holds after **each** test. Defaults to 10 s headed, 0 headless; `0` disables. |
| `E2E_SLOWMO` | Milliseconds of delay per action, to watch the steps themselves. |
| `E2E_HOLD_MS` | Extra hold at the end of the login spec only. |

## Discovering / updating selectors

The username/password fields live on the dev-iam page. To capture or verify
selectors against the live page:

```bash
npm run codegen -- <E2E_BASE_URL>/login
```

## Layout

```
e2e/
  tests/auth/login.spec.ts   # login through dev-iam -> /app/console
  support/test-base.ts       # shared `test` with the post-test pause
  fixtures/                  # auth storage state (gitignored)
  global-setup.ts            # local-build only: patch the served index.html
  playwright.config.ts       # baseURL + creds from .env.e2e
```

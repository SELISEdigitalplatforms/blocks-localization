# Blocks Localization; End-to-End Tests (Playwright)

E2E tests that drive the real app through the browser, including the dev-iam
login redirect flow.

## One-time setup

1. **Configure env**: copy the template and fill in your values:

   ```bash
   cd e2e
   cp .env.e2e.example .env.e2e
   ```

   Set `E2E_USERNAME` and `E2E_PASSWORD`. `.env.e2e` is gitignored; never
   commit real credentials.

2. **Install** Playwright + the browser:

   ```bash
   cd e2e
   npm install
   npx playwright install chromium
   ```

   `./run.sh -te` does both of these for you on first run.

3. **Start the app** (local Vite on `:4000`):

   ```bash
   # from repo root; requires LOCALIZATION_SSL_CERT / KEY in your shell
   ./run.sh -f
   ```

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

## Target modes

### Local Vite frontend (recommended for dev + codegen)

```
E2E_BASE_URL=https://dev-localization.blocksdevelopers.com:4000
E2E_NO_WEBSERVER=1
```

Start Vite first: `./run.sh -f` from the repo root. Playwright hits the
frontend dev server; OIDC still redirects to dev-iam.

Requires `/etc/hosts`:

```
127.0.0.1 dev-localization.blocksdevelopers.com
```

and `LOCALIZATION_SSL_CERT` / `LOCALIZATION_SSL_KEY` exported (see
`ssl_certificate_guideline/projects/blocks-localization.md`).

### Remote dev

```
E2E_BASE_URL=https://dev-localization.blocksdevelopers.com
E2E_NO_WEBSERVER=1
```

OS is derived automatically (`dev-os.blocksdevelopers.com`). Override with
`E2E_OS_BASE_URL` if needed.

Nothing is built or started locally. You will see this on every remote run,
and it is correct:

```
[e2e] index.html not found at .../server/Api/wwwroot/index.html — skipping BLOCKS_LOCALIZATION_BASE_URL patch.
```

### Local API build

Build the client and run the .NET server:

```bash
./run.sh          # client build + dotnet run
```

Then point the tests at it:

```
E2E_BASE_URL=https://dev-localization.blocksdevelopers.com:5000
# leave E2E_NO_WEBSERVER unset
```

With `E2E_NO_WEBSERVER` unset, Playwright starts `run.sh -b` itself.

### Remote prod

```
E2E_BASE_URL=https://localization.seliseblocks.com
E2E_NO_WEBSERVER=1
PROJECT_NAME=LOCALIZATION-TEST   # optional
```

OS is derived automatically (`os.seliseblocks.com`). Use credentials valid for
prod IAM; captcha is not automated.

## Playwright MCP (Cursor)

Project-scoped MCP config is **local only** (`.cursor/` is gitignored in this
repo). Copy the example and restart Cursor:

```bash
mkdir -p .cursor
cp mcp.server.example.json .cursor/mcp.json
```

Or, if your workspace root is `blocks-localization/`:

```bash
mkdir -p ../.cursor
cp mcp.server.example.json ../.cursor/mcp.json
# then edit ../.cursor/mcp.json; change config path to "e2e/playwright.mcp.json"
```

Both register the official Playwright MCP server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--config", "playwright.mcp.json"]
    }
  }
}
```

`playwright.mcp.json` enables `ignoreHTTPSErrors` for mkcert local certs.

**Enable:** restart Cursor → Settings → MCP → confirm `playwright` is active.

**Use:** ask Cursor to navigate, snapshot, or interact with
`https://dev-localization.blocksdevelopers.com:4000` using the Playwright MCP
tools; same host and TLS settings as the test suite.

## Deterministic codegen workflow

Do **not** commit raw codegen output as tests. Use codegen to discover
selectors, then add them to page objects in `support/pages/`.

```bash
cd e2e
npm run codegen:login     # record /login flow → copy selectors into support/pages/
npm run codegen           # open at E2E_BASE_URL root
npm run codegen:console   # record post-auth console (log in manually first)
```

Page objects (`LoginPage`, `OidcLoginPage`, `ConsolePage`) are the single
source of truth for locators. Specs import page objects only; no inline
selectors.

Implementation plan: `docs/plan-playwright-mcp-codegen.md`.

## Runtime config

`client/index.html` carries `window.__BLOCKS_ENV__` with placeholder tokens that
`server/Api/Program.cs` replaces at startup from the DB-backed `FrontendRuntime`
config section. The key this suite cares about is
**`__BLOCKS_LOCALIZATION_BASE_URL__`** / `FrontendRuntime__BLOCKS_LOCALIZATION_BASE_URL`.

## Knobs in `.env.e2e`

| Variable                        | Effect                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `E2E_BASE_URL`                  | Blocks **Localization** host. Dev: `https://dev-localization.blocksdevelopers.com`. Prod: `https://localization.seliseblocks.com`. |
| `E2E_OS_BASE_URL`               | Blocks **OS** host (optional). Derived when omitted: `dev-localization`→`dev-os`, `localization.`→`os.`. |
| `PROJECT_NAME`                  | Optional prefix for created projects (`${PROJECT_NAME} ${Date.now()}`; default `Test Project`).    |
| `E2E_USERNAME` / `E2E_PASSWORD` | IAM test account (captcha is disabled on dev).                                                     |
| `E2E_NO_WEBSERVER=1`            | Don't auto-start the app. Required for remote or `:4000` Vite.                                     |
| `E2E_PAUSE_MS`                  | How long the browser holds after **each** test. Defaults to 10 s headed, 0 headless; `0` disables. |
| `E2E_SLOWMO`                    | Milliseconds of delay per action, to watch the steps themselves.                                   |

See `SPEC-multi-env.md` for Dev/Prod derivation rules and create-project flow notes.

## Lifecycle

Playwright projects: **`localization-setup` → `localization` → `localization-teardown`**

1. **Suite setup** (`tests/suite/suite.setup.spec.ts`) — OIDC login, reuse or create one shared project, write `localization-project.json`, then save `localization-session.json` **after** the dashboard is open (so localStorage keeps project/env).
2. **Features** (`tests/01-overview` … `06-extension-guides`) — use session; open pages with a direct `goto` to `/app/{itemId}/dashboard` or `/app/{itemId}/services/...`.
3. **Session / context recovery** — login gate or console bounce → re-auth if needed, one env-chip open to reseed localStorage, persist session (never create a new project).
4. **Suite teardown** (`tests/suite/suite.teardown.spec.ts`) — delete on **Blocks OS** only when every `localization` test passed (unless `E2E_KEEP_PROJECT=1`).

## Layout

```
e2e/
  tests/
    auth/login.spec.ts
    suite/
      suite.setup.spec.ts             # login → project → session (after dashboard open)
      suite.teardown.spec.ts          # OS delete when suite passed
    01-overview/overview.spec.ts
    02-translations/translations.spec.ts
    03-modules/modules.spec.ts
    04-glossary/glossary.spec.ts
    05-configuration/configuration.spec.ts
    06-extension-guides/extension-guides.spec.ts
  support/
    env.ts
    login-helper.ts
    create-and-delete-project.ts
    localization-project.ts           # localization-session / localization-project fixtures
    suite-helpers.ts                  # openSharedProjectDashboard
    localization-helpers.ts           # direct /app/{id}/dashboard + /services/... routes
    run-outcome.ts
    test-base.ts
  fixtures/                           # gitignored (localization-session.json + localization-project.json)
  SPEC-multi-env.md
  playwright.config.ts
```

Playwright projects:

- **`setup`** — `tests/auth/login.spec.ts` login smoke
- **`localization-setup`** — reuse/create shared project, save session **after** dashboard open
- **`localization`** — feature specs; `storageState` from `localization-session.json`
- **`localization-teardown`** — OS delete when suite passed (`E2E_KEEP_PROJECT=1` keeps it)

Feature routes (direct URL):

| Area | Path |
|---|---|
| Overview | `/app/{itemId}/dashboard` |
| Translations | `/app/{itemId}/services/language` |
| Modules | `/app/{itemId}/services/modules` |
| Glossary | `/app/{itemId}/services/glossary` |
| Configuration | `/app/{itemId}/services/configure` |
| Extension Guides | `/app/{itemId}/services/extension-guides` |

Same suite shape as `blocks-utilities/e2e` (`utilities-setup` → `utilities` → `utilities-teardown`).

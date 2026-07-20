# Blocks Localization (blocks-localization)

> Product name: **Blocks Localization**. The legacy name *EuroLM* survives only
> in internal plumbing (namespaces such as `Eurolm.DomainService`, `eurolm_*`
> message queues) and is being retired incrementally.

ASP.NET Core (**net10.0**) + React (Vite, TypeScript) **Blocks Identity / cloud admin** surfaces with **Blocks Localization** domain extensions (`Eurolm.DomainService`, legacy *EuroLM* naming). The web host (**Genesis**/Blocks configuration, FluentValidation, health checks) serves the SPA from `server/Api/wwwroot`; `GlobalApiRoutePrefixConvention` prefixes attribute routes with `api`. A separate **Worker** (`blocks-eurolm-worker`) runs message consumers. Node/npm are for the client toolchain (`npm install`, `npm run dev`, `npm run build`).

## Project structure

```
blocks-localization/
├── client/                                   # React + Vite + TypeScript (package name: blocks-localization-client)
│   ├── app/                                  # Source (iam, cross-modules, routes, components, lib, …)
│   │   ├── iam/                              # Auth, IAM, captcha, API settings, …
│   │   ├── cross-modules/                     # Shared areas (ai, communication, identifier, lmt, …)
│   │   ├── routes/, pages/, layouts/, hooks/
│   │   └── lib/                              # e.g. get-api-path.ts, runtime-env.ts, http-client.ts
│   ├── index.html                            # Inline __BLOCKS_* placeholders for prod substitution
│   ├── vite.config.ts                        # build.outDir → ../server/Api/wwwroot; dev port 4000; BLOCKS_ env
│   ├── package.json
│   └── .env.example                           # Template for local BLOCKS_* (copy to .env)
├── server/
│   ├── Api/                                  # Kestrel host (static SPA + JSON API)
│   │   ├── Controllers/                      # See “API / routing” below (~23 controllers)
│   │   ├── wwwroot/                          # Vite output (generated; do not edit)
│   │   ├── Program.cs                        # Middleware, SPA fallback, optional token replacement into built assets
│   │   ├── Api.csproj
│   │   └── Properties/launchSettings.json    # Example: http://localhost:5000
│   ├── Worker/                               # Background consumers (hosted service name in code)
│   ├── Eurolm.DomainService/                  # EuroLM-specific services and data
│   ├── DomainService/                        # Standalone *.csproj on disk — not in Blocks.slnx; most `DomainService.*` namespaces live under other *Domain* projects
│   ├── Authentication.DomainService/
│   ├── Captcha.DomainService/
│   ├── Cloud.DomainService/
│   ├── Cloud.LmtService/
│   ├── CloudConfiguration.DomainService/
│   ├── Iam.DomainService/
│   ├── Identifier.DomainService/
│   ├── Mfa.DomainService/
│   ├── *_Driver/                             # Captcha.Driver, Iam.Driver, Mfa.Driver (outside solution)
│   ├── XUnitTest/
│   ├── Directory.Build.props                   # TargetFramework net10.0
│   └── Blocks.slnx                            # Api, domain projects, Worker, XUnitTest
├── run.sh                                    # Build client → run API from server/Api
├── run-app-combined.sh                       # Optional npm i, build, Worker + API on :5000; optional dist→wwwroot rsync*
├── run-api-only.sh                           # Free :5000, dotnet run Api
├── run-fe-only.sh                            # Prompt for Vite `--host`; map /etc/hosts; npm run dev
├── run-worker-only.sh                         # dotnet run Worker
├── Dockerfile, Dockerfile.worker              # CI/production images (multi-stage API + Worker)
├── LICENSE
├── README.md
└── …
```

\*With the current `client/vite.config.ts`, `vite build` writes **directly** to `server/Api/wwwroot`. If `client/dist` does not exist, the rsync branch in `run-app-combined.sh` is skipped; the SPA is already in `wwwroot` from the build step.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) — see `server/Directory.Build.props` (`net10.0`)
- [Node.js](https://nodejs.org/) (local dev; **[Dockerfile](Dockerfile)** uses **Node 22** for reproducible frontend builds)

### Local infrastructure

This app expects Genesis/Blocks configuration and backing services appropriate to your environment. For local stacks (databases, messaging, related services), use **[blocks-infra](https://github.com/SELISEdigitalplatforms/blocks-infra)** Docker Compose **as documented in that repository** (`docker compose up`, etc.) — bring Compose up **before** or alongside the API/Worker here so connectivity and vault/secrets behave as intended.

Docker alone is optional for raw `dotnet`/`npm` runs unless you explicitly depend on that Compose stack.

## How to run

**Ports**

| Process | Typical port |
|--------|----------------|
| API (Kestrel) | **5000** (`server/Api/Properties/launchSettings.json`) |
| Vite (`npm run dev`) | **4000** (`client/vite.config.ts` and `client/package.json` script) |

`launchSettings.json` governs **`dotnet run` from the IDE**; shell scripts enforce **5000** their own way (see below).

---

### **`run.sh`** (simple integration)

Runs from repo root:

1. `npm run build` in `client/` (fills `server/Api/wwwroot` per Vite)
2. `dotnet run` in `server/Api/`

No flags. Example:

```bash
chmod +x run.sh   # once
./run.sh
```

---

### **`run-app-combined.sh`**

- Installs **`client/node_modules`** with `npm i` only if missing
- Builds the client (`npm run build`)
- If **`client/dist/`** exists, rsync-syncs **`client/dist/`** → **`server/Api/wwwroot/`** (`rsync -a --delete`) — redundant when Vite output already targets `wwwroot` (current config)
- Frees listeners on **`5000`** via `lsof` + kill
- Starts **Worker** as a **background** job, then runs **Api** (foreground); **Ctrl+C** / cleanup stops the Worker

Example:

```bash
chmod +x run-app-combined.sh
./run-app-combined.sh
```

---

### **`run-api-only.sh`**

Frees **5000**, then `dotnet run` on **`server/Api/Api.csproj`** from repo root.

```bash
./run-api-only.sh
```

---

### **`run-worker-only.sh`**

`dotnet run` on **`server/Worker/Worker.csproj`** (no API port logic).

```bash
./run-worker-only.sh
```

---

### **`run-fe-only.sh`**

- Parses **`block` dev host from `package.json`** `scripts.dev` (`--host …`)
- Prompts for a domain (defaults to detected host); may append **`127.0.0.1 <domain>`** to **`/etc/hosts`** (**sudo**)
- Clears **`4000`** the same pattern as combined script does for **`5000`**
- Writes the chosen **`--host`** back into **`package.json`**
- Runs **`npm run dev`** in **`client/`**

Use this when you want Vite hot reload behind a hostname you map locally.

---

### Windows

There is **no `run.ps1`** in this repository. Use **WSL** or **Git Bash** for the `.sh` scripts, or invoke **dotnet**/ **npm** manually (below).

---

## Without the scripts

Ensure `wwwroot` is populated (either run **`npm run build`** in **`client/`** first, or your publish pipeline copied assets):

```bash
dotnet run --project server/Api/Api.csproj
```

Worker separately:

```bash
dotnet run --project server/Worker/Worker.csproj
```

Frontend dev server (see **`vite.config.ts`**: **`BLOCKS_API_BASE_URL`** enables dev proxy prefixes such as **`/api`**, **`/iam`**, **`/communication`**, etc.):

```bash
cd client && npm install && npm run dev
```

## Client environment (`BLOCKS_*`)

Vite **`envPrefix`** is **`BLOCKS_`** (`client/vite.config.ts`). For **production** bundles, placeholders in `client/index.html` can be rewritten at startup by **`server/Api/Program.cs`** using process environment (**`DotNetEnv`**) for:

- **`BLOCKS_API_BASE_URL`**
- **`BLOCKS_X_BLOCKS_KEY`**
- **`BLOCKS_GOOGLE_SITE_KEY`**
- **`BLOCKS_CONSTRUCT_URL`**

Copy **`client/.env.example`** → **`client/.env`** for values consumed at **`npm run`** / **`vite build`** time.

| Variable | Role |
|---------|------|
| **`BLOCKS_API_BASE_URL`** | API base URL; **`import.meta.env`** and runtime replacement; triggers Vite proxy when non-empty (`client/vite.config.ts`) |
| **`BLOCKS_X_BLOCKS_KEY`** | **`X-Blocks-Key`** and project-style usage (`client/app/lib/http-client.ts`, auth/IAM flows) |
| **`BLOCKS_GOOGLE_SITE_KEY`** | hCaptcha/Google flows in auth forms |
| **`BLOCKS_CONSTRUCT_URL`** | Construct service links (`client/app/lib/runtime-env.ts`, OIDC/UI) |
| **`BLOCKS_APP_URL`** | Build-time branching in PAT/SSO UI (`import.meta.env`) |
| **`BLOCKS_BASE_DOMAIN`** | Project/help domain fallback (`client/app/hooks/use-project.ts`) |
| **`BLOCKS_BLOCKED_MENU`** | JSON string for menu filtering (`client/app/hooks/use-filtered-menus.ts`) |
| **`BLOCKS_GITHUB_CLIENT_ID`** | DevOps/GitHub OAuth client id (`client/app/cross-modules/devops/services/providers.service.ts`) |

Type-only / optional: **`BLOCKS_CLOUD_DASHBOARD_URL`** is declared in `client/app/vite-env.d.ts` — search usages if you rely on it.

Server-side (**API** startup): **`BLOCKS_VAULT_TYPE`** selects Genesis vault parsing when set; otherwise **`ASPNETCORE_ENVIRONMENT`/`Development` → OnPrem**, else **`Azure`** (`server/Api/Program.cs`, `server/Worker`).

Rebuild the client after changing build-time **`BLOCKS_*`**.

## Production / publish

Frontend build publishes into **`server/Api/wwwroot`**:

```bash
(cd client && npm ci && npm run build)
dotnet publish server/Api/Api.csproj -c Release -o ./publish
```

No Node process is needed on the server at runtime unless you deliberately run tooling there. Prefer the repo **Dockerfiles** for consistent Node + SDK versions.

Worker image/pattern: **`Dockerfile.worker`**.

## API / routing

- Controllers: **`server/Api/Controllers/`** (e.g. **Authentication**, **Iam**, **Mfa**, **Captcha**, **Key**, **Mail**, **Storage**, **Assistant**, **Module**, **Project**, **People**, **Language**, **Glossary**, **Migration**, **Log**, **Trace**, **Notification**, **Discovery** (routes under **`[Route(".well-known")]`** prefixed with **`api`**), …).
- Global prefix: **`api`** — **`GlobalApiRoutePrefixConvention`** in **`Program.cs`** prefixes every controller **`[Route(...)]`**.
- SPA: **`UseDefaultFiles`**, **`UseStaticFiles`**, **`MapFallbackToFile("/index.html")`** when `wwwroot/index.html` exists (`Program.cs`).
- **`/api`** is effectively reserved by the ASP.NET routing convention; Genesis may also expose other path prefixes in middleware — tune CORS/origin **when splitting Vite (**`:4000`**) from Kestrel (**`:5000`**)**.

## License

See [LICENSE](LICENSE).

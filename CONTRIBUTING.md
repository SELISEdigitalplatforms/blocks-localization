# Contributing to Blocks Localization

`blocks-localization` (product name: **Blocks Localization**; the legacy names
*EuroLM* and *UILM* survive only in internal plumbing such as namespaces and
message-queue identifiers and are being retired incrementally) is a .NET
(`net10.0`) web host + Worker plus a React/Vite SPA. This document records the
conventions that tooling cannot fully check. Naming/style rules that **can** be
checked are enforced via [`.editorconfig`](./.editorconfig) +
`EnforceCodeStyleInBuild` (see `server/Directory.Build.props`) and, for the
client, the conventions below.

## Naming

### C# (server)

- **Interfaces** are `I`-prefixed PascalCase (`IKeyManagementService`).
- **Types** (class/struct/enum/delegate) and **members** (method/property/event)
  are PascalCase.
- **Parameters** and **locals** are camelCase.
- **Constants** are PascalCase.
- **Private fields** are `_camelCase`.
- **`Task`-returning methods** carry the **`Async`** suffix
  (`SaveKeyAsync`). This cannot be expressed as an `.editorconfig` naming rule,
  so it is enforced by review. Do not ship new public typos (a historical
  `DeleteAsysnc` exists; new spellings must be correct, and renames follow the
  obsolete-old-keep-new rule below).
- **DTO suffixes**: request DTOs end in `Request`, response DTOs in `Response`,
  events in `Event`, consumers in `Consumer`.
- **Namespaces** match folder structure. Never declare service types into the
  shared `Blocks.Genesis` namespace; that namespace belongs to the platform
  package.

### TypeScript (client)

- **Files** are kebab-case. Hooks are `use-*.ts`, services are `*.service.ts`,
  tests are `*.test.ts(x)`, and the file name matches its primary export.
- **Types/interfaces/components** are PascalCase; **variables/functions** are
  camelCase; **constants** are `UPPER_SNAKE_CASE` or camelCase per module norm.

> ESLint is set up in `client/` (`.eslintrc.cjs`) and includes a
> `@typescript-eslint/naming-convention` rule; run it with
> `npm --prefix client run lint`. Filename casing is still enforced by review.

## HTTP API

- **Verbs**: read-only endpoints use `GET`; mutations use `POST`/`PUT`/`DELETE`.
  Do not use `POST` for a pure read.
- **Routes** are kebab/lower-case and spelled correctly; attribute routes are
  prefixed with `api` by `GlobalApiRoutePrefixConvention`.
- **Route renames are backward-compatible**: add the new route and keep the old
  one marked `[Obsolete]` delegating to the new handler. Never hard-break a
  published route.

## Permission scopes

- Grammar is `service::controller::action`, all lower-case, e.g.
  `blocks-localization::key::save`.
- **Never silently change an existing scope string**: it would revoke access
  for already-granted principals. A scope rename requires a coordinated IAM seed
  update (`server/seed/localization-permissions.upsert.json`) and grant
  migration; raise it as its own task.

## Response envelope

This service intentionally uses its **own** `ApiResponse` shape
(`Success` + `ValidationErrors`). It is deliberately distinct from the shared
Genesis `BaseResponse` (`IsSuccess` + `Errors`). Do **not** unify them here -
that is a separate cross-repo Genesis effort. New endpoints return `ApiResponse`.

## Backward-compatible renames (obsolete-old-keep-new)

Any public/wire-facing identifier rename keeps the old symbol working:

- **C#**: keep the old symbol `[Obsolete("Renamed to <New>.")]` forwarding to the
  new one.
- **JSON wire fields**: add the new field and keep accepting the old one.
- **TypeScript**: `/** @deprecated use <new> */ export const oldName = newName;`

Deep namespace/package renames (e.g. `Eurolm.DomainService`) and message-queue
identifier renames (`eurolm_*`) are deferred: they are wire/deployment contracts
that need bus + infra coordination.

## Branch model

- `main`: production-ready code (protected)
- `dev`: integration branch (protected); all pull requests target `dev`
- `inception`: the working branch; day-to-day work happens here

Never commit directly to `dev` or `main`. Work on `inception` and open a pull
request from `inception` into `dev`. Do not force-push and do not rewrite
published history.

## Commit conventions

Match the style already in the log. Most commits use Conventional Commits
(`type(scope): subject`, for example `test(client): ...`, `chore(e2e): ...`);
a plain imperative subject is also used for straightforward changes. Keep the
subject concise and explain the what and the why in the body when it is not
obvious.

## Build & test gates

Before opening a PR, the suites must be green and your change must not reduce
coverage:

```bash
# backend
dotnet test server/XUnitTest/XUnitTest.csproj

# frontend
npm --prefix client run test

# e2e (needs a reachable app and e2e/.env.e2e, see e2e/README.md)
npm --prefix e2e run test
```

Security scanning gates (SAST, dependency and secret scanning via
`scripts/scan.sh` where the scanning environment is available) must report no
new findings. Fix findings in real code or real dependency versions; do not
suppress rules, lower thresholds or delete tests to make a scan pass.

## Review expectations

- Keep pull requests small and focused; describe what changed, why, and how it
  was tested.
- CI runs the build, tests and scans on every pull request into `dev`.
- At least one maintainer must approve before merge.
- Update `README.md` and any affected docs in the same pull request.

## Reporting a security issue

Do not open a public issue for a suspected vulnerability. Follow the private
disclosure process in [SECURITY.md](SECURITY.md).

## Repo hygiene

Do not commit build or scratch artifacts. Generated XML doc output is emitted
into `bin/` (via `GenerateDocumentationFile`) and is gitignored; coverage output,
`*.Backup.tmp`, `puku-embeddings.db`, and similar scratch files are ignored too.

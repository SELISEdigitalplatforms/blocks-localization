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

> An automated ESLint `@typescript-eslint/naming-convention` + filename rule is
> not yet wired up in `client/` (the client has no ESLint setup today). Adding
> it is tracked separately; until then the rules above are enforced by review.

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
- **Never silently change an existing scope string** — it would revoke access
  for already-granted principals. A scope rename requires a coordinated IAM seed
  update (`server/seed/localization-permissions.upsert.json`) and grant
  migration; raise it as its own task.

## Response envelope

This service intentionally uses its **own** `ApiResponse` shape
(`Success` + `ValidationErrors`). It is deliberately distinct from the shared
Genesis `BaseResponse` (`IsSuccess` + `Errors`). Do **not** unify them here —
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

## Build & test gates

Before opening a PR, both suites must be green:

```bash
# backend
dotnet test server/XUnitTest/XUnitTest.csproj

# frontend
cd client && npx vitest run
```

## Repo hygiene

Do not commit build or scratch artifacts. Generated XML doc output is emitted
into `bin/` (via `GenerateDocumentationFile`) and is gitignored; coverage output,
`*.Backup.tmp`, `puku-embeddings.db`, and similar scratch files are ignored too.

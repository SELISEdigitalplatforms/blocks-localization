# Blocks Localization (`blocks-localization`) — Technical Specification

> **Product-naming status — Open / undecided.** The `DECISIONS-blocks-localization.md` file supplied as ground truth contains only a header and captured **no** authoritative naming or convention decisions, so no answered ticket exists to settle the naming split. The code uses three names for one product: **"Blocks Localization"** (SPA/browser-tab title, `Constants.ServiceName = "blocks-localization"`, Swagger title "Blocks Localization API"), **"EuroLM" / "Eurolm"** (server namespaces `Eurolm.*`, project `Eurolm.DomainService`, worker `blocks-localization-worker`/`blocks-eurolm-worker`, queue prefix `eurolm_*`, README "Blocks EuroLM"), and **"UILM"** (the client API-base alias `API_BASES.UILM`, the generated dictionary artifacts `UilmFile`, the sample module "UILM Tool"). This spec uses **Blocks Localization** as the working product name and the repo id `blocks-localization` as the stable identifier. Wherever a "decided target" is cited below it is inferred from the seed data / cross-service conventions, not from a captured decision; those are marked **Inferred target**.

Blocks Localization is the translation-management service of the SELISE Blocks platform. It stores every piece of user-facing UI text as a named **key**, holds each key's per-language values as **resources**, groups keys into **modules**, translates them by hand / AI / offline file round-trip, and **publishes** compiled JSON dictionaries that consuming apps read at runtime. It is project-scoped (multi-tenant) and authenticates through blocks-iam via OIDC.

---

## 1. Technology Stack

**Backend**
- **.NET 10** (`net10.0`, `Directory.Build.props`; `Nullable` + `ImplicitUsings` enabled), ASP.NET Core / Kestrel.
- Two runnable hosts: **`server/Api`** (Kestrel host that serves the SPA from `wwwroot` and exposes the JSON API) and **`server/Worker`** (`blocks-localization-worker`, a `Host`-based background service running message consumers).
- **SeliseBlocks.Genesis** (`Blocks.Genesis`) — the platform framework: configuration/vault loading, `BlocksContext` (tenant/identity context), `ProtectedEndPoint` authorization attribute, messaging abstractions (`MessageConfiguration`, consumer subscriptions), health checks, `GlobalApiRoutePrefixConvention`.
- **SeliseBlocks.ConfigurationDriver**, **SeliseBlocks.StorageDriver** (object storage — AWS S3-compatible via `DomainService.Storage` / `Storage.DomainService`).
- **FluentValidation** / **FluentValidation.AspNetCore** — request and entity validation.
- **MongoDB** driver (via Genesis repositories; `[BsonId]`, `[BsonIgnoreExtraElements]` on entities).
- **ClosedXML** (xlsx), **CsvHelper** (csv), **Newtonsoft.Json** (json / XLIFF handling).
- AI translation via HTTP to an OpenAI-compatible **chat-completions** endpoint (`AiCompletionUrl`, default `https://api.openai.com/v1/chat/completions`), model `gpt-4o-mini`, Bearer token decrypted from vault.

**Frontend**
- **React 18 + TypeScript**, built with **Vite** (dev port 4000; `build.outDir → ../server/Api/wwwroot`).
- **@seliseblocks/blocks-kit** `0.0.60` — shared console shell, layout, auth guards, OIDC callback, project switcher.
- **@tanstack/react-query** (data fetching) + **@tanstack/react-table** (tables), **react-router-dom** v6, **react-hook-form**, **radix-ui** primitives, **tailwindcss** (+ `tailwindcss-animate`), **lucide-react**, **sonner** (toasts), **react-dropzone** (file import), **nuqs** (URL query state).
- Client package name is `blocks-idp-client` (the repo is a fork of the IAM/IDP client shell with a localization cross-module bolted on under `app/cross-modules/localization`).

**Data store**
- **MongoDB** for all business collections (per-tenant), plus a root `Secrets` collection that backs runtime configuration.
- **Object storage** (S3-compatible) for generated/exported/imported translation files.

**Infra**
- Docker (`Dockerfile` for the API+SPA, `Dockerfile.worker` for the worker).
- GitHub Actions: `ci-dev.yml`, `ci-stg.yml`, `ci_prod.yml` (+ `.github/variables/*.env`).
- Vault providers: Azure (default/cloud) or OnPrem (Development), selected by `BLOCKS_VAULT_TYPE` / environment.
- Messaging: Azure Service Bus (default) or RabbitMQ (auto-detected from an `amqp(s)://` connection string).

---

## 2. Solution / Module Structure

Server solution `server/Blocks.slnx` (the repo also carries many unrelated `*.DomainService` projects inherited from the IDP shell — Authentication, Captcha, Cloud, Iam, Mfa, Identifier, etc.; the localization product lives in the `Eurolm.*` projects).

| Project / folder | Responsibility |
|---|---|
| `server/Api` | Kestrel host. `Program.cs` (vault + secrets bootstrap, DB-backed `FrontendRuntime` token substitution into built SPA assets, SPA fallback, `GlobalApiRoutePrefixConvention("api")`). `Controllers/` — 6 controllers (Key, Language, Module, Glossary, Assistant, Config). Serves the Vite SPA from `wwwroot`. |
| `server/Worker` | `blocks-localization-worker`. Hosts the message consumers and a `PeriodicPingBackgroundService`. Same DI registration (`AddEurolmRegisterApplicationServices`) and secret bootstrap as the API. |
| `server/Eurolm.DomainService` | The domain library shared by API and Worker. Subfolders: `Services/` (Key, Language, Module, Glossary, Assistant, HelperService), `Repositories/` (Mongo repositories + persisted entities `BlocksLanguageKey`, `BlocksLanguageModule`), `Shared/` (`ServiceRegistry`, `ApiResponse`, `BaseEntity`, `IProjectKey`, `Utilities/Constants`, `Entities/`, `Events/`, `DTOs/`), `Validation/` (FluentValidation validators). |
| `server/Eurolm.Driver` | Thin driver project. |
| `server/Worker/Consumers` | 7 message consumers (see §7). |
| `server/seed` | `localization-permissions.upsert.json` — 27 IAM permission upsert documents; `permission-upsert-seed-generic.md` guidance. |
| `server/XUnitTest` | xUnit test project (Api / Services / Repositories / Worker / Validation / Shared). |
| `client/app/cross-modules/localization` | The entire product UI: `language-module/` (language-table, key-details, modules, configure, export-history, localization-timeline, activity-log, timeline, add-new-language-key), `components/` (modals: auto-translate, edit-translation, edit-key, edit-route, export-key, import-language-file, tag-glossary, glossary, gpt-prompt), `services/`, `hooks/`, `store/`, `constants/` (`endpoint.constant.ts`), `models/`. |
| `client/app/router.tsx` | Route table (see §3). |

---

## 3. API Surface

**Routing conventions.** Every controller is `[ApiController]` with `[Route("[controller]/[action]")]`; `GlobalApiRoutePrefixConvention("api")` prepends `api`, so effective routes are `POST /api/{Controller}/{Action}`. The client references them through `API_BASES.UILM` (which resolves to `/api`) — e.g. `GENERATE_UILM_FILE = /api/Key/GenerateUilmFile`.

**Authorization grammar.** Protected endpoints carry `[ProtectedEndPoint("blocks-localization::{resource}::{action}")]`. The canonical grammar is three colon-separated segments; the seed and most attributes use lowercase actions. **Inconsistency (current state):** the assistant scope is camel-cased — `blocks-localization::assistant::getTranslationsuggestion` — in both the controller and the seed, and the glossary `GetSuggestedGlossaries` scope `blocks-localization::glossary::get-suggested-glossaries` is **commented out** in the controller and absent from the seed. **Inferred target:** normalise all actions to a single lowercase convention and register every protected action in the seed.

**Response envelope (current state — mixed).** Write endpoints return the local `ApiResponse` (`{ Success, ErrorMessage, ValidationErrors }`); several return raw domain types (`Key?`, `List<Language>`, `BlocksWebhook?`, typed `*Response` DTOs), some return `IActionResult`, and the two runtime-file endpoints write directly to the response stream. **Inferred target:** converge on one consistent success/error envelope across the surface.

### KeyController (`/api/Key`)
| Action | Verb | Scope (`blocks-localization::…`) | Request → Response |
|---|---|---|---|
| Save | POST | `key::save` | `Key` → `ApiResponse` (if `ShouldPublish`, queues module regeneration + timeline entry) |
| SaveKeys | POST | `key::savekeys` | `List<Key>` → `ApiResponse` (bulk, shared operation id) |
| Gets | POST | `key::gets` | `GetKeysRequest` → `GetKeysQueryResponse` (paged; filters: module, translation status, missing languages, date range) |
| GetsByKeyNames | POST | `key::getkeysbykeynames` | `GetKeysByKeyNamesRequest` → `GetKeysByKeyNamesResponse` |
| GetTimeline | GET | `key::gettimeline` | `GetKeyTimelineRequest` → `GetKeyTimelineQueryResponse` |
| GetLocalizationTimeline | GET | **(none — unprotected)** | `GetLocalizationTimelineRequest` → `GetLocalizationTimelineResponse` |
| GetTimelineByOperationId | GET | **(none — unprotected)** | `GetTimelineByOperationIdRequest` → `GetKeyTimelineQueryResponse` |
| Get | GET | `key::get` | `GetKeyRequest` → `Key?` |
| Delete | DELETE | `key::delete` | `DeleteKeyRequest` → `IActionResult` |
| DeleteKeys | DELETE | `key::deletekeys` | `DeleteKeysRequest` → `IActionResult` |
| GetCloudUilmFile | GET | **(none — unprotected)** | `GetUilmFileRequest` → streams compiled dictionary |
| GetUilmFile | GET | **(none — unprotected)** | `GetUilmFileRequestForClient` → streams compiled dictionary (runtime consumption by apps) |
| GenerateUilmFile | POST | `key::generateuilmfile` | `GenerateUilmRequest` → `IActionResult` (publish; no module id ⇒ all modules) |
| TranslateAll | POST | `key::translateall` | `TranslateAllRequest` → `IActionResult` (queued) |
| TranslateKey | POST | `key::translatekey` | `TranslateBlocksLanguageKeyRequest` → `IActionResult` (queued) |
| TranslateKeys | POST | `key::translatekeys` | `TranslateBlocksLanguageKeysRequest` → `IActionResult` (queued) |
| UilmImport | POST | `key::uilmimport` | `UilmImportRequest` → `IActionResult` (queued; json/csv/xlsx/xlf) |
| UilmExport | POST | `key::uilmexport` | `UilmExportRequest` → `IActionResult` (queued) |
| DeleteCollections | POST | `key::deletecollections` | `DeleteCollectionsRequest` → `IActionResult` |
| GetUilmExportedFiles | GET | `key::getuilmexportedfiles` | `GetUilmExportedFilesRequest` → `IActionResult` (export history) |
| GetLanguageFileGenerationHistory | GET | `key::getlanguagefilegenerationhistory` | `GetLanguageFileGenerationHistoryRequest` → `IActionResult` |
| RollBack | POST | `key::rollback` | `RollbackRequest` → `IActionResult` |

### LanguageController (`/api/Language`)
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| Save | POST | `language::save` | `Language` → `ApiResponse` |
| GetCloudsLanguages | GET | **(none)** | → `List<Language>` |
| Gets | GET | **(none)** | `projectKey` → `List<Language>` |
| Delete | DELETE | `language::delete` | `DeleteLanguageRequest` → `IActionResult` |
| SetDefault | POST | `language::setdefault` | `SetDefaultLanguageRequest` → `IActionResult` |

### ModuleController (`/api/Module`)
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| Save | POST | `module::save` | `SaveModuleRequest` → `ApiResponse` |
| GetCloudsModules | GET | **(none)** | → `List<BlocksLanguageModule>` |
| Gets | GET | **(none)** | `projectKey` → `List<BlocksLanguageModule>` |
| TagGlossary | POST | `module::tagglossary` | `TagGlossaryRequest` → `BaseMutationResponse` |
| ~~Delete~~ | — | — | **Commented out** in source (module delete not exposed) |

### GlossaryController (`/api/Glossary`)
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| Save | POST | `glossary::save` | `Glossary` → `ApiResponse` |
| Gets | GET | **(none)** | `GetGlossariesRequest` → `GetGlossariesResponse` |
| Get | GET | **(none)** | `itemId` → `IActionResult` |
| GetSuggestedGlossaries | GET | **(scope commented out — unprotected)** | `GetSuggestedGlossariesRequest` → `GetSuggestedGlossariesResponse` |
| Delete | DELETE | `glossary::delete` | `DeleteGlossaryRequest` → `IActionResult` |

### AssistantController (`/api/Assistant`)
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| GetTranslationSuggestion | POST | `assistant::getTranslationsuggestion` *(camelCase — see note)* | `SuggestLanguageRequest` → `IActionResult` |

### ConfigController (`/api/Config`)
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| GetCloudWebHook | GET | **(none)** | → `BlocksWebhook?` |
| GetWebHook | GET | **(none)** | `projectKey` → `ActionResult<BlocksWebhook?>` |
| SaveWebHook | POST | `config::savewebhook` | `BlocksWebhook` → `ApiResponse` |

**Security note (current state):** all `Gets`/`Get`/`GetClouds*`/webhook-read/timeline-read and the two runtime-file endpoints have **no** `[ProtectedEndPoint]` and no class-level `[Authorize]`, so they are effectively unauthenticated reads. The runtime `GetUilmFile` being open is plausibly intentional (apps pull published dictionaries), but exposing glossaries, webhook config, timelines, languages and modules unauthenticated is technical debt — see §10.

### Client routes (`client/app/router.tsx`, under `/app/:itemId/services`)
`services/language` (Translations home) · `services/language/translations/new-key` · `services/language/translations/:keyId` · `services/language/export-history` · `services/language/logs` · `services/modules` · `services/modules/:moduleId` · `services/configure` · `services/glossary` · `services/glossary/:glossaryId`. `:itemId` is the Blocks project. There is **no** UI route for environment migration (worker-only capability).

---

## 4. Data Model

All persisted business entities derive from `BaseEntity` (`ItemId` `[BsonId]`, `CreateDate`, `LastUpdateDate`, `CreatedBy`, `LastUpdatedBy`, **`TenantId`**) and are stored in MongoDB, one logical dataset per tenant/project.

- **BlocksLanguageKey** (persisted key): `KeyName`, `ModuleId`, `Value`, `Resources[]`, `Routes[]`, `GlossaryIds[]?`, `Context?`, `IsPartiallyTranslated`. The API-facing `Key` DTO adds `IsNewKey` and `ShouldPublish?`.
- **Resource** (one language's value of a key): `Value`, `Culture` (language code, e.g. `en`, `de-DE`), `CharacterLength`.
- **Language**: `LanguageName`, `LanguageCode`, `IsDefault` (the single source language auto-translation translates *from*).
- **BlocksLanguageModule** (persisted module; internally "application"): `ModuleName`, `Name`. The `Module` DTO is `ItemId` + `ModuleName`. A module is the unit a published file is built for; a key belongs to exactly one module via `ModuleId`.
- **Glossary**: `Name`, `Language?`, `Type?`, `Context?`, `AdditionalNote?`, `IsGlobal`, `ModuleIds[]?`. Applied at three tiers (global / per-module via `ModuleIds` / per-key via `Key.GlossaryIds`) to steer AI translation toward preferred terms.
- **UilmFile** (published runtime artifact): `Id`, `TenantId`, `ModuleName`, `Language`, `Content` (the serialized `{ keyName: value }` JSON dictionary). One per module per language; missing values render as the `[ KEY MISSING ]` placeholder.
- **KeyTimeline** / **BlocksLanguageManagerTimeline** (audit): derive from `BlocksBaseTimelineEntity<CT,PT>` (`EntityId`, `CurrentData`, `PreviousData`, `LogFrom`, `UserId`, `RollbackFrom`); `KeyTimeline` adds `UserName`, `OperationId`. Every create/save/delete/translate/import/publish writes an entry; a key can be rolled back to a prior `PreviousData`.
- **LanguageFileGenerationHistory** — versioned record of each publish/generate run.
- **BlocksWebhook**: `ItemId`, `Url`, `ContentType`, `BlocksWebhookSecret { Secret, HeaderKey }`, `IsDisabled`. One outbound webhook config per tenant.
- **Exported-file / MigrationTracker** records — export-history entries and migration progress.

**Per-tenant isolation.** Enforced in code via `BlocksContext.GetContext()?.TenantId` (the Blocks **project key**), read at the top of the management services and stamped onto every entity and query. Read endpoints that take an explicit `projectKey` query parameter (e.g. `Language/Gets`, `Module/Gets`, webhook reads) rely on the caller-supplied key rather than the ambient context — a consistency gap worth tightening.

---

## 5. Authentication & Authorization

- **Identity / SSO.** Users authenticate through **blocks-iam** via **OIDC** (Authorization Code + PKCE), handled by `@seliseblocks/blocks-kit` guards and the `/login/callback` route in the SPA. OIDC client ids / base URLs / callback URLs are injected into the built SPA at deploy time from the DB-backed `FrontendRuntime` config (`__BLOCKS_*__` token substitution in `Program.cs`).
- **Tenancy.** Multi-tenant via the platform **`X-Blocks-Key`** tenant key; the resolved tenant/project id is exposed to server code as `BlocksContext.GetContext().TenantId` and used for both data scoping and stamping.
- **Authorization.** Genesis's `[ProtectedEndPoint("blocks-localization::{resource}::{action}")]` validates the caller's permissions against IAM. Permissions are seeded into the shared IAM permission collection from `server/seed/localization-permissions.upsert.json` (27 endpoint permissions, `ResourceGroup: "localization"`, `Type: "Endpoint"`, `IsBuiltIn: true`, severities Medium/…). IAM decides who may save/translate/publish/delete.
- **Gaps.** (1) Many read endpoints and the two runtime-file endpoints are unprotected (see §3). (2) One scope is camelCase; one is commented out and unseeded. (3) **No dedicated translator role** exists today — the persona split (translator edit/translate vs admin publish/delete) is not modelled; roles would need to be composed from the seeded permissions in IAM. **Open / undecided** whether a limited translator role ships.
- **AI secret handling.** The OpenAI Bearer token is stored **encrypted** in the vault (`ChatGptEncryptedSecret` + `ChatGptEncryptionKey`), decrypted at call time (AES via `Rfc2898DeriveBytes` with an app `Salt`), and sent as `Authorization: Bearer` to `AiCompletionUrl`.

---

## 6. Integrations & Dependencies

**Other Blocks services**
- **blocks-iam** — OIDC login + permission enforcement (hard dependency).
- **blocks-os** — Blocks Localization renders inside the OS console shell (layout, project switcher, dashboard) via `blocks-kit`; reached by opening a project and choosing the localization service.
- **blocks-data** — **not** used as a data gateway; Blocks Localization owns its MongoDB collections directly. It does depend on the platform **object-storage** driver for exported/imported/generated files.
- **blocks-monitor** — not a runtime dependency. The product's own "Logs / Timeline" is a business audit trail, not infra monitoring.
- **Notification service** — publish/translate/import completions call `NotificationServiceUrl` (Blocks Logic `Notifier/SendSecretNotification`) to raise in-app notifications, and an "Extension Sync" notification is fired on module publish for an external **"extension"** consumer that is **not in this repo** (owner/nature **Open / undecided**).

**External**
- **OpenAI-compatible chat-completions API** (`AiCompletionUrl`, default `api.openai.com`, model `gpt-4o-mini`) for AI auto-translation.
- **Outbound webhook** (customer-configured `BlocksWebhook`) called when files are generated / translated / imported.

**Key packages** — server: `SeliseBlocks.Genesis`, `SeliseBlocks.ConfigurationDriver`, `SeliseBlocks.StorageDriver`, `MongoDB.*`, `FluentValidation(.AspNetCore)`, `ClosedXML`, `CsvHelper`, `Newtonsoft.Json`. Client: `@seliseblocks/blocks-kit`, `@tanstack/react-query`+`react-table`, `react-router-dom`, `react-hook-form`, `radix-ui`, `tailwindcss`, `react-dropzone`, `sonner`, `nuqs`.

---

## 7. Messaging / Eventing

Long-running operations are dispatched from the API onto queues and processed by the Worker. Provider is Azure Service Bus by default, RabbitMQ if the message connection string is `amqp(s)://` (`Constants.GetMessageConfiguration`).

| Queue (`Constants`) | Event | Consumer | Purpose |
|---|---|---|---|
| `eurolm_listener` | `GenerateUilmFilesEvent` | `GenerateUilmFilesConsumer` | Publish: compile `{keyName:value}` JSON per module per language, replace old `UilmFile`s, bump generation history, fire webhook + notification |
| `eurolm_translate_all_keys_listener` | `TranslateAllEvent` | `TranslateAllEventConsumer` | AI-translate all untranslated keys |
| `eurolm_translate_blocks_language_key_listener` | `TranslateBlocksLanguageKeyEvent` | `TranslateBlocksLanguageKeyEventConsumer` | AI-translate one key |
| `eurolm_translate_blocks_language_keys_listener` | `TranslateBlocksLanguageKeysEvent` | `TranslateBlocksLanguageKeysEventConsumer` | AI-translate a selected set of keys |
| `eurolm_import_export_listener` | `UilmImportEvent` / `UilmExportEvent` | `UilmImportEventConsumer` / `UilmExportEventConsumer` | Parse an uploaded file into keys/values, or generate an export file (xlsx/csv/json/xlf) into storage |
| `eurolm_environment_data_migration_listener` | `EnvironmentDataMigration` (+ `MigrationCompletionEvent`) | `EuroLMEnvironmentDataMigrationEventConsumer` | Copy modules then keys from a source project to a target project (optional overwrite); notify on completion |

The Worker also runs a `PeriodicPingBackgroundService`. Completion of each operation raises an in-app notification and, where relevant, the outbound webhook. The camel/legacy `eurolm_*` queue names and `Eurolm.*` namespaces are the same product as "Blocks Localization" (naming split — §1).

---

## 8. Configuration & Environments

- **Secrets & runtime config** load from the platform **vault** (Azure in cloud, OnPrem in Development, selectable via `BLOCKS_VAULT_TYPE`) plus a DB-backed MongoDB `Secrets` document keyed **`blocks-secret-localization`**, merged into `IConfiguration`. This supplies `DatabaseConnectionString`, `RootDatabaseName`, `MessageConnectionString`, the `FrontendRuntime` block, `RootTenantId`, `NotificationServiceUrl`, `Salt`, and the encrypted ChatGPT secret/key.
- **App settings** per environment: `appsettings.json` + `.dev` / `.stg` / `.prod` / `.Development` for both Api and Worker. Notable keys: `AiCompletionUrl` (`https://api.openai.com/v1/chat/completions`), `ChatGptTemperature` (`0.1`), `NotificationServiceUrl`, `Salt`, `RootTenantId`, Swagger metadata.
- **Frontend runtime injection.** The SPA ships with `__BLOCKS_*__` placeholders; `Program.cs` rewrites `.html/.js/.css/.json` in `wwwroot` at startup from the `FrontendRuntime` section (base URLs, callback URLs, client ids for iam/os/data/monitor/… and `BLOCKS_X_BLOCKS_KEY`, `BLOCKS_GOOGLE_SITE_KEY`). Env vars `FrontendRuntime__BLOCKS_*` override individual keys at deploy time.
- **Uploads** capped at **15 MB** (`FormOptions.MultipartBodyLengthLimit`).
- **Local dev** — client `.env.example` → `.env` with `BLOCKS_*`; Vite dev on port 4000, API example on `:5000`; helper scripts `run.sh`, `run-api-only.sh`, `run-fe-only.sh`, `run-worker-only.sh`, `run-app-combined.sh`.
- **Environments** — dev / stg / prod via the three CI workflows and `.github/variables/*.env`.

---

## 9. Testing & Quality

- **Backend:** `server/XUnitTest` (xUnit) with suites under `Api/`, `Services/`, `Repositories/`, `Worker/`, `Validation/`, `Shared/` — ~54 test source files; coverage output under `TestResults/`.
- **Frontend:** **Vitest** (`vitest.config.ts`) + Testing Library + **MSW** (mock handlers under `localization/test-utils/msw`); ~74 `*.test.ts(x)` files; coverage report generated under `client/coverage` (clover.xml + HTML).
- **CI:** GitHub Actions `ci-dev` / `ci-stg` / `ci_prod`.
- **Coverage gate — Open / undecided.** Per the standing test-coverage effort the target is ~85% across the Blocks repos, but **no** enforced coverage threshold / gate decision was captured in the (empty) DECISIONS file; whether CI fails below a threshold is undecided here.

---

## 10. Known Technical Debt & Decisions

> **No ticket-backed resolutions were available** — the authoritative `DECISIONS-blocks-localization.md` was empty. The items below are grounded in code; each "Inferred target" is an engineering recommendation, **not** a captured product decision, and each open product question is flagged for a ticket.

1. **Tri-name product identity (Blocks Localization / EuroLM / UILM).** Namespaces, queues, README use EuroLM; API base alias + artifacts use UILM; UI/service id use Blocks Localization. *Inferred target:* pick one customer-facing name, retire the others to internal-only, and stop leaking "EuroLM"/"UILM" into user-visible surfaces. **Undecided — needs ticket.**
2. **Unauthenticated read/runtime endpoints.** `Gets`/`Get`/`GetClouds*`, webhook reads, `GetLocalizationTimeline`, `GetTimelineByOperationId`, and both `GetUilmFile` endpoints carry no auth attribute. *Inferred target:* protect all except the deliberately-public runtime dictionary fetch; document the runtime endpoint's intended public contract explicitly. **Security debt.**
3. **Scope-grammar inconsistency.** `assistant::getTranslationsuggestion` is camelCase; `glossary::get-suggested-glossaries` is commented out and unseeded. *Inferred target:* normalise to lowercase `{resource}::{action}` and seed every protected action.
4. **Response-envelope inconsistency.** Mix of `ApiResponse`, raw domain types, and `IActionResult`. *Inferred target:* one envelope across the surface.
5. **Two publish paths.** `Key/Save` with `ShouldPublish=true` silently regenerates that module's files, competing with the deliberate all-modules `GenerateUilmFile` ("Publish Changes"). Risk of surprise go-lives before a translator is ready. **Product question — needs ticket** (should publishing always be explicit?).
6. **No review/approval gate on AI output.** AI translations can reach published files without a human approval step. **Product question — needs ticket.**
7. **No translator role.** Persona split (translate/edit vs publish/delete) is not modelled as an IAM role. **Product question — needs ticket.**
8. **Environment migration has no UI.** Worker-only capability; trigger path/ownership unclear. **Product question — needs ticket.**
9. **External "extension" consumer + webhook** are referenced but the consumer is out-of-repo; ownership and whether it is a core promise are unknown. **Open / undecided.**
10. **Import/export format asymmetry.** Backend reads json/csv/xlsx/xlf; the import UI advertises fewer formats (notably XLIFF/xlf may not be user-facing on import). *Inferred target:* make the export and import format lists match (or intentionally document the difference).
11. **`Module/Delete` commented out** — modules cannot be deleted through the API today. Decide whether deletion is supported (and how orphaned keys/published files are handled).
12. **Self-contained data & audit.** Localization keeps its own Mongo collections and its own timeline rather than using blocks-data / blocks-monitor. **Open / undecided** whether this stays permanent.
13. **`[ KEY MISSING ]` fallback** shown for untranslated keys in live apps. **Product question — needs ticket** (acceptable, vs. fall back to default-language text?).

---

## 11. Non-Functional Requirements

**Security**
- OIDC (Auth Code + PKCE) via blocks-iam; per-endpoint permission scopes via Genesis `ProtectedEndPoint`.
- AI provider secret stored encrypted in vault, decrypted only at call time (AES/PBKDF2 with app salt); never shipped to the client.
- All platform config/secrets resolved from vault + DB `Secrets`, not from source. Webhook secrets stored with the config.
- **Must-close before GA:** protect the currently-open read endpoints (§10.2) and normalise auth scopes (§10.3).

**Multi-tenancy**
- Every business entity carries `TenantId` (the Blocks project key); services scope all reads/writes to `BlocksContext…TenantId`. Environment migration is the only sanctioned cross-tenant data movement (source→target project copy). *Consistency risk:* several reads trust a caller-supplied `projectKey` instead of the ambient tenant context — should be reconciled.

**Performance / scalability**
- Expensive operations (translate-all, per-key/selected translation, publish/generate, import, export, environment migration) are offloaded to background queues (Azure Service Bus or RabbitMQ) with async in-app notifications, keeping the API responsive.
- Published `UilmFile` dictionaries are precompiled per module per language and served (and stored in object storage), so runtime consumers do a cheap dictionary fetch rather than assembling translations on demand.
- AI calls use a fixed low temperature (`0.1`) and a compact model (`gpt-4o-mini`); AssistantService wraps calls with circuit-breaker-style logging. Upload size capped at 15 MB.

---

*Grounded in `server/` (controllers, `Eurolm.DomainService`, `Worker/Consumers`, `seed/localization-permissions.upsert.json`, `Program.cs`, `appsettings*`) and `client/app/cross-modules/localization` + `router.tsx` as of this revision. Items marked "Open / undecided" or "needs ticket" reflect that the supplied authoritative decisions file was empty; they should be resolved and folded back in.*

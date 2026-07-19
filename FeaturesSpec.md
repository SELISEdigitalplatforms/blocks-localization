# Blocks Localization (name undecided) — Features Specification

> One-line note: derived from the Business/Product/Technical/Architecture specs + the code on `inception` + the authoritative product decisions. Status reflects the ACTUAL code as verified against the implementation.

> **Product name is undecided.** The decisions file (`DECISIONS-blocks-localization.md`) is empty — no product-owner decision overrides the code. Three names ship side by side: **Blocks Localization** (service id `blocks-localization` in `Constants.ServiceName`, SPA "Translations" tab), **EuroLM / Eurolm** (`Eurolm.DomainService` namespace, `eurolm_*` queues, README title "Blocks EuroLM"), and **UILM** (compiled files, runtime endpoints). This spec uses the repo id **blocks-localization**. Canonical-name decision is open (ProductSpec Q-A1).

## How to Read
Status legend: **✅ Shipped** (implemented, matches intended behaviour) · **🟡 Partial** (implemented but with a gap vs the decision/intent) · **🔴 Defect** (implemented but broken/incorrect) · **🗺️ Roadmap** (decided, not yet built) · **❓ Undecided** (no decision yet). Every status is grounded in code.

Because the decisions file is empty, no ratified target overrides code; statuses measure code against **intended behaviour as documented in the Product/Technical/Architecture specs** and against the open GitHub issues (#224–#236). Ticket numbers are cited where a known bug/limitation is already filed.

---

## 1. Feature Inventory

### 1A. Languages & Configuration

### Language management — 🟡 Partial
- **What it does:** Add/save a language, delete a language, list languages, and mark one language `IsDefault` (the AI translation *source*). `LanguageController` (`Save`, `GetCloudsLanguages`, `Gets`, `Delete`, `SetDefault`); `LanguageManagementService`; entity `BlocksLanguage`.
- **Current status:** All five operations exist and are wired to the client. `SetDefaultLanguage` (LanguageManagementService.cs:94-122) *does* enforce a single default — it sets the target `IsDefault=true` and calls `RemoveDefault` on the rest. So the "exactly one default" behaviour holds **only through the SetDefault path**.
- **Limitations:**
  - `Save` writes `repoLanguage.IsDefault = language.IsDefault` directly (LanguageManagementService.cs:89) with **no unset-others step** — saving a language with `IsDefault=true` can create a *second* default, silently bypassing the single-default invariant that only `SetDefault` guarantees.
  - `SetDefaultLanguage` runs `SaveAsync(language)` and `RemoveDefault(language)` concurrently via `Task.WhenAll` (lines 115-118); the ordering is not serialized, a latent race under concurrent default changes.
  - `Gets(projectKey)` is **unauthenticated** — `[ApiExplorerSettings(IgnoreApi=true)]` only (LanguageController.cs:58-60); a caller-supplied `projectKey` returns that tenant's language set with no auth (#227).
  - Whether exactly one default must always exist is a product open question (Q-A5); "default" vs "source language" label unresolved.
- **Suggested changes:**
  1. **P1** — Secure `Gets` with `[ProtectedEndPoint]` or derive `projectKey` from `BlocksContext` instead of the query string (#227).
  2. **P2** — Make single-default an invariant of `Save` too (unset other defaults, or reject `IsDefault=true` on `Save` and force clients through `SetDefault`).
  3. **P3** — Serialize the SetDefault save/remove instead of `Task.WhenAll`; settle the "source language" label (Q-A5).

### Webhook configuration — 🟡 Partial
- **What it does:** Store an outbound webhook (`Url`, `ContentType`, secret `HeaderKey`+`Secret`, `IsDisabled`) invoked when files are generated/translated/imported. `ConfigController` (`GetCloudWebHook`, `GetWebHook`, `SaveWebHook`); entity `BlocksWebhook`; `WebHookService`.
- **Current status:** Save + read + invoke all present. The webhook is actually called from three worker consumers: `GenerateUilmFilesConsumer`, `TranslateAllEventConsumer`, `UilmImportEventConsumer` (all call `_webHookService.CallWebhook`).
- **Limitations:**
  - `GetWebHook(projectKey)` is **unauthenticated** (ConfigController.cs:35-37, `IgnoreApi` only) — returns a tenant's webhook config, **including the secret header material path**, to any caller who supplies a `projectKey` (#227).
  - Webhook is **not** fired on single/bulk key translation (`TranslateBlocksLanguageKeyEventConsumer` / `…KeysEventConsumer` have no `CallWebhook`), only on Translate-All — so "notify on translate" is partial vs the ProductSpec claim.
  - Controller filename typo `ConfigConroller.cs` (class is correct `ConfigController`) (#230); return-type `ActionResult<BlocksWebhook?>` is the only one of its shape in the repo (#233).
  - What external system consumes the webhook is undecided (Q-B3, Q-D4).
- **Suggested changes:**
  1. **P1** — Authenticate `GetWebHook` (#227).
  2. **P2** — Fire the webhook from the per-key translate consumers too (or document that only Translate-All notifies), so the "notify on translate" contract is consistent.
  3. **P3** — Rename `ConfigConroller.cs` (#230).

### 1B. Keys & Translations

### Translation keys (CRUD, bulk, search, get-by-names) — 🟡 Partial
- **What it does:** Create/update a key (`KeyName`, `ModuleId`, per-language `Resources`, optional `Context`, `Routes`, `GlossaryIds`), single + bulk save, single + bulk delete, filtered/paged search, and fetch keys by an array of names. `KeyController` (`Save`, `SaveKeys`, `Gets`, `GetsByKeyNames`, `Get`, `Delete`, `DeleteKeys`); `KeyManagementService`.
- **Current status:** Full CRUD + search present and client-wired; every mutation writes a timeline entry under an operation id.
- **Limitations:**
  - **Discarded validation guards (#224):** in `GetTimelineByOperationId` (:135), `Get` (:148,:162), `Delete` (:177), `GetCloudUilmFile` (:232), `GetUilmFile` (:243), `TranslateAll` (:273) the `BadRequest(...)` result is computed but **not returned** — null input falls straight through to the service instead of short-circuiting.
  - **Read-over-POST (#233):** `Gets` (:79) and `GetsByKeyNames` (:92) are `[HttpPost]` despite being pure reads — uncacheable, non-idempotent to proxies. Every other `Gets` in the repo is `[HttpGet]`.
  - **Scope↔method drift (#232):** method `GetsByKeyNames` guarded by scope `key::getkeysbykeynames` ("Gets" vs "getkeys") breaks any generated scope→endpoint map.
  - Envelope sprawl: `Save`/`SaveKeys`/`Gets` return `ApiResponse`/typed DTOs while `Delete`/`RollBack`/etc. return `IActionResult` and a couple return bare `Task` (#233).
- **Suggested changes:**
  1. **P1** — Add the missing `return` to the 6 discarded-guard sites so null input fails fast (#224).
  2. **P2** — Convert `Gets`/`GetsByKeyNames` to `GET` (or accept POST and document why), and align the `getkeysbykeynames` scope name with the method (#232, #233).
  3. **P3** — Standardise on one response envelope across the controller (#233).

### Modules — 🟡 Partial
- **What it does:** Named grouping of keys (internally "application"); each module produces its own published file. `ModuleController` (`Save`, `GetCloudsModules`, `Gets`, `TagGlossary`); entity `BlocksLanguageModule`.
- **Current status:** Create/update, list, and glossary-tagging work. **Module delete is commented out** (ModuleController.cs:68-75).
- **Limitations:**
  - **Delete-module is a live UI bug (#228):** the client still ships `LANGUAGE_MODULE_ENDPOINTS.DELETE = /api/Module/Delete`, `deleteLanguageModule()`, and a wired delete-module modal, but the server endpoint is commented out → the modal **hits a 404 and silently fails** while appearing to work. The existing test mocks the HTTP layer so it passes against the dead route.
  - `Gets(projectKey)` module read is **unauthenticated** (ModuleController.cs:61-63) (#227).
  - `TagGlossary` returns `BaseMutationResponse` — the only endpoint in the repo using it (#233).
  - What a Module *is* (whole app / feature area / folder) is undecided (Q-A3).
- **Suggested changes:**
  1. **P1** — Either restore `Module.Delete` (with a real `[ProtectedEndPoint]` and cascade rules for the module's keys + generated files) or remove the client delete UI so it stops silently 404ing (#228).
  2. **P1** — Authenticate the module `Gets` (#227).
  3. **P3** — Decide the module definition (Q-A3).

### AI auto-translation — 🔴 Defect
- **What it does:** Fill missing per-language values from the default-language source, steered by merged glossary context, per key / selected keys / all-untranslated. `AssistantController.GetTranslationSuggestion`, `AssistantService.SuggestTranslation`; `Key/TranslateKey|TranslateKeys|TranslateAll` → worker consumers. Uses a ChatGPT-style completion at `AiCompletionUrl` with `ChatGptTemperature`, Bearer secret AES-decrypted at call time.
- **Current status:** Wired end-to-end (sync suggestion endpoint + async queue path). Glossary tiers are merged and de-duplicated before the prompt.
- **Limitations:**
  - **Retry logic discards a last-retry success (AssistantService.cs:77-91):** after the `while (empty && retryCount<3)` loop, `if (retryCount >= maxRetryCount) return null;` fires whenever the **3rd retry** produced a non-empty translation — the loop exits on success with `retryCount==3`, then the guard throws the good value away and returns `null`. A translation that only succeeds on the final attempt is silently lost. (No ticket yet — found in this review.)
  - **Silent authz downgrade on the sync endpoint (#232):** scope is `assistant::getTranslationsuggestion` — camelCase in an all-lowercase convention, and IAM matches scopes literally, so this scope likely never matches → the endpoint is effectively unprotected (or unreachable) depending on IAM behaviour. Also the mangled word "Translationsuggestion".
  - **No enforced human-review gate:** AI output is saved as the key value and can go live via auto-publish with no approval step (Q-B2).
  - Prompt building ignores glossary `AdditionalNote` and `Language` (`BuildGlossaryContext`, AssistantService.cs:109-126 uses only `Name`/`Type`/`Context`) — glossary richness is under-used (Q-B6).
  - Fixed 5s delay × up to 3 retries can stall a worker for ~15s per failing key.
- **Suggested changes:**
  1. **P1** — Fix the retry guard: return `aiText` when it is non-empty regardless of `retryCount`; only return `null` when the loop exits still-empty.
  2. **P1** — Lowercase the assistant scope to `assistant::gettranslationsuggestion` and re-seed IAM (#232).
  3. **P2** — Decide + (if required) enforce a review gate before AI output can publish (Q-B2).
  4. **P3** — Include `AdditionalNote` in the glossary prompt; make retry backoff configurable.

### Glossary — 🟡 Partial
- **What it does:** Preferred-term definitions at three tiers (global / per-module / per-key), merged + de-duplicated by `ItemId` for the AI prompt, plus a "suggested glossaries" matcher. `GlossaryController` (`Save`, `Gets`, `Get`, `GetSuggestedGlossaries`, `Delete`); `AssistantService` tier-merge (lines 46-69).
- **Current status:** CRUD + three-tier merge present and used by the assistant.
- **Limitations:**
  - **Authz downgraded (#232):** `GetSuggestedGlossaries` has its `[ProtectedEndPoint(...glossary::get-suggested-glossaries)]` **commented out**, leaving bare `[Authorize]` — any authenticated user, no scope check (GlossaryController.cs:65-68). `Gets` and `Get` are likewise `[Authorize]`-only.
  - Glossary `Language` field and the "suggested glossaries" UX are undecided (Q-B6); `AdditionalNote` unused in prompts (see AI feature).
- **Suggested changes:**
  1. **P2** — Restore the `get-suggested-glossaries` scope (and confirm it is seeded in IAM) (#232).
  2. **P3** — Define the intended use of the glossary `Language` field and the suggestion matcher (Q-B6).

### 1C. Publish & Runtime Delivery

### Publish / generate runtime UILM files — ✅ Shipped
- **What it does:** Compile a JSON dictionary `{ keyName: value }` per module per language, replace prior files, record a generation-history version, and fire webhook + notification. `Key/GenerateUilmFile` → `GenerateUilmFilesConsumer` → `KeyManagementService.GenerateAsync`/`ProcessUilmFile`.
- **Current status:** Present and correct; no `ModuleId` ⇒ all modules, a `ModuleId` ⇒ just that module. Webhook fires on completion.
- **Limitations:**
  - Absent values are written as the literal `[ KEY MISSING ]` placeholder (KeyManagementService.cs:908), not a fallback to source-language text — this string ships into consuming apps (Q-A4).
  - Publish is a full regenerate-and-replace per module; no partial/delta publish, no dry-run/preview of what will change.
- **Suggested changes:**
  1. **P2** — Decide the missing-value policy (fall back to default-language value vs. keep `[ KEY MISSING ]`) and make it configurable (Q-A4).
  2. **P3** — Add a publish preview (diff of keys that will change) before regenerating all modules.

### Auto-publish on key save (`ShouldPublish`) — 🟡 Partial
- **What it does:** Saving a key with `ShouldPublish==true` queues UILM regeneration for that module. `KeyManagementService` SaveKey (lines 100-108) and SaveKeys (lines 170-178).
- **Current status:** Present in both single and bulk save paths.
- **Limitations:** Coexists with the deliberate all-modules "Publish Changes"; a save can trigger a surprise per-module go-live with no confirmation. Whether publishing should always be deliberate is undecided (Q-B4). Auto-publish inherits the `[ KEY MISSING ]` behaviour.
- **Suggested changes:**
  1. **P2** — Decide deliberate-only vs. allow-implicit publish; if implicit stays, surface a clear "this will go live" affordance on save (Q-B4).

### Runtime consumption endpoint — 🔴 Defect (security)
- **What it does:** Serve a compiled dictionary to a running app by project + module + language. `Key/GetCloudUilmFile` (`[Authorize]`) and `Key/GetUilmFile` (client-facing, `IgnoreApi`).
- **Current status:** Both return the JSON dictionary directly to the response stream.
- **Limitations:**
  - **`GetUilmFile` is unauthenticated (#227):** `[ApiExplorerSettings(IgnoreApi=true)]` only, and it takes a caller-supplied `projectKey` — anyone who can guess/obtain a `projectKey` reads that tenant's published translations. `Program.cs` sets no fallback authorization policy, so "hidden from Swagger" is the only protection.
  - Null-request guard is a discarded `BadRequest` (KeyController.cs:243) (#224).
  - Whether the pull endpoint or the push webhook is the standard delivery path is undecided (Q-B3).
- **Suggested changes:**
  1. **P1** — Put `GetUilmFile` behind an appropriate auth mechanism for public runtime reads (signed URL, per-project runtime token, or an API-key scope), rather than an unauthenticated `projectKey` query (#227).
  2. **P2** — Add a fallback authorization policy in `Program.cs` so a forgotten attribute cannot leave an endpoint open (#227).

### 1D. Import / Export

### Export — 🟡 Partial
- **What it does:** Export selected modules/languages to a downloadable file, tracked in Export History. `Key/UilmExport` → `UilmExportEventConsumer`; output generators for JSON/XLSX/CSV/XLF (`JsonOutputGeneratorService`, `XlsxOutputGeneratorService`, `CsvOutputGeneratorService`, `XlfOutputGeneratorService`).
- **Current status:** Backend supports JSON/XLSX/CSV **and XLF**; the Export UI (`export-key.tsx:57-62`) offers **JSON / XLSX / CSV only** — `{ id:5, label:"Xlf" }` is commented out. There is also an **orphaned XLF reference-file upload path** in the same modal (`selectedOutputType === 5 && xlfFile`, lines 89-170) that can never fire because format 5 is not selectable.
- **Limitations:** Backend capability > exposed UI; the XLF upload code is dead. Which formats should be exportable is undecided (Q-B7).
- **Suggested changes:**
  1. **P2** — Decide on XLF export: either re-enable `{ id:5, label:"Xlf" }` and finish the reference-file flow, or remove the dead XLF upload code from the modal (Q-B7).

### Import — 🟡 Partial
- **What it does:** Upload a file to merge values back into keys (existing updated, new added, removed ignored; modules not replaced). `Key/UilmImport` → `UilmImportEventConsumer`.
- **Current status:** Import UI `ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".json"]` (import-file-modal.tsx:49); backend can additionally parse XLF (`messages.xlf` / `messages.{lang}.xlf`), so import formats < backend capability and < export intent.
- **Limitations:** No XLF in the import allow-list despite backend support; import/export format lists don't match each other (Q-B7). Merge is additive-only — no way to prune keys removed upstream.
- **Suggested changes:**
  1. **P2** — Align import/export format lists; add `.xlf`/`.xliff` to `ALLOWED_EXTENSIONS` if the XLIFF vendor round-trip is in scope (Q-B7, Q-C3).
  2. **P3** — Consider an opt-in "delete keys absent from the file" mode for true sync.

### 1E. History, Audit & Rollback

### Change history (timeline) & rollback — 🟡 Partial
- **What it does:** Every create/save/delete/translate/import/publish writes a timeline entry grouped by operation id; a key can be rolled back. `Key/GetTimeline`, `GetLocalizationTimeline`, `GetTimelineByOperationId`, `RollBack`; entity `BlocksLanguageManagerTimeline`.
- **Current status:** Timeline writes + per-key/per-operation reads + rollback all present.
- **Limitations:**
  - `GetLocalizationTimeline` and `GetTimelineByOperationId` are `[Authorize]`-only — **no dedicated `blocks-localization::…` scope** (KeyController.cs:118-137), unlike the scoped `GetTimeline`. Inconsistent access control.
  - `GetTimelineByOperationId` has a discarded `BadRequest` guard (#224).
  - Rollback scope covers a single key (`RollbackRequest.ItemId`); no operation-level "undo this whole import/publish".
- **Suggested changes:**
  1. **P2** — Add scopes to the two `[Authorize]`-only timeline endpoints (e.g. `key::gettimeline`) for consistent authz.
  2. **P3** — Add operation-level rollback (revert an entire operation id).

### Language file generation history — ✅ Shipped
- **What it does:** Paginated history of publish/generation runs (versions). `Key/GetLanguageFileGenerationHistory`.
- **Current status:** Present, scope-guarded (`key::getlanguagefilegenerationhistory`), paged with validation.
- **Limitations:** Separate from Export History; whether both histories are needed is undecided (Q-B5). No restore-to-version (rollback operates on keys, not on a generation snapshot).
- **Suggested changes:**
  1. **P3** — Clarify overlap with Export History (Q-B5); consider "republish this version" from a history row.

### Export history — ✅ Shipped
- **What it does:** Paginated list of exported files for download. `Key/GetUilmExportedFiles`; entity `UilmExportedFile`.
- **Current status:** Present, scope-guarded, paged with validation; client Export-History page wired.
- **Limitations:** No retention/expiry policy on stored export artifacts; overlaps conceptually with generation history (Q-B5).
- **Suggested changes:**
  1. **P3** — Define a retention/cleanup policy for exported files in storage.

### 1F. Platform & Cross-Project

### Environment data migration — 🔴 Defect / 🗺️ Roadmap
- **What it does:** Copy modules then keys from a source project to a target project (optional overwrite), with a completion notification. `EuroLMEnvironmentDataMigrationEventConsumer`; `EnvironmentDataMigration` event; `MigrationTracker`; `KeyManagementService.PublishEnvironmentDataMigrationNotification`.
- **Current status:** The **consumer, event, tracker, and notification exist**, but there is **no producer** — no controller endpoint and no client code publishes `EnvironmentDataMigrationEvent` (only tests reference it). The migration cannot be triggered in-product.
- **Limitations:**
  - **The "Environments" nav item is a dead link:** `navigation-menus.ts:45-49` points to `/app/project-overview/environments`, but `router.tsx` defines no such route (only `services/*` paths) — clicking it resolves to nothing.
  - No trigger surface, no source/target picker, no overwrite toggle in the UI (Q-C4, Q-D3).
- **Suggested changes:**
  1. **P2** — Either build the migration trigger (endpoint + Environments page that publishes the event) or hide the dead "Environments" nav item until it exists.
  2. **P3** — Decide the migration scenario and whether it is self-service (Q-C4).

### Background worker pipeline — ✅ Shipped
- **What it does:** Long operations run asynchronously off `eurolm_*` queues with in-app completion notifications. Consumers: `GenerateUilmFiles`, `TranslateAll`, `TranslateBlocksLanguageKey(s)`, `UilmExport`, `UilmImport`, `EuroLMEnvironmentDataMigration`. Separate `Dockerfile.worker` / `run-worker-only.sh`.
- **Current status:** All seven consumers present and registered in `ServiceRegistry`.
- **Limitations:** No visible dead-letter/failure-surface for a job that fails all retries (e.g. AI never returns); the `EnvironmentDataMigration` consumer has no producer (see above). Notification-only feedback; no job-status query endpoint.
- **Suggested changes:**
  1. **P3** — Add a job-status/failure surface so a stuck translate/import is visible beyond a one-shot notification.

### Permissions / access control — 🟡 Partial
- **What it does:** 27 `blocks-localization::…` endpoint permissions (ResourceGroup `localization`) seeded into IAM via `server/seed/localization-permissions.upsert.json`; each mutating endpoint carries a `[ProtectedEndPoint]`.
- **Current status:** 27 permissions confirmed in the seed (Save Language, Set Default Language, Search Localization Keys, Generate UILM File, Translate…, Import/Export UILM File, Rollback, etc.).
- **Limitations:**
  - **Four endpoints return tenant data with no auth (#227):** `Config.GetWebHook`, `Language.Gets`, `Module.Gets`, `Key.GetUilmFile` — `IgnoreApi` hides them from Swagger but does not secure them; each takes a caller-supplied `projectKey`. Cross-tenant read risk.
  - **Silent authz gaps (#232):** `assistant::getTranslationsuggestion` scope is mis-cased (likely never matches); `glossary::get-suggested-glossaries` scope is commented out (bare `[Authorize]`).
  - Several reads are `[Authorize]`-only with **no scope** (both localization-timeline endpoints, glossary `Gets`/`Get`, `GetCloudsLanguages/Modules`, `GetCloudWebHook`).
  - **No translator-vs-admin role split** — no role that permits edit/translate but forbids publish/delete (Q-D5).
- **Suggested changes:**
  1. **P1** — Close the four unauthenticated endpoints and add a `Program.cs` fallback-deny policy (#227).
  2. **P1** — Fix the two broken/removed scopes (#232).
  3. **P2** — Define a translator role (edit/translate, not publish/delete) (Q-D5).

---

## 2. Cross-Cutting Limitations

- **Unauthenticated tenant-data endpoints (#227) — highest risk.** Four `projectKey`-parameterised reads (`GetWebHook`, `Language.Gets`, `Module.Gets`, `GetUilmFile`) rely only on `IgnoreApi` for "protection." No global fallback authorization policy exists in `Program.cs`, so any endpoint that forgets its attribute is open by default. Cross-tenant read is possible with a guessed/leaked `projectKey`.
- **Scope-matching fragility as silent authz failure (#232).** IAM matches scopes literally, so a casing typo (`assistant::getTranslationsuggestion`) or a commented-out scope (`glossary::get-suggested-glossaries`) is not a compile error — it downgrades or breaks authorization silently. There is no test asserting seeded-scope ↔ endpoint-attribute parity.
- **Discarded validation guards (#224).** Six `KeyController` actions compute `BadRequest(...)` without returning it, so null/invalid input falls through to the service layer — inconsistent error behaviour and possible NREs.
- **Response-envelope inconsistency (#233).** Five return-type shapes across six controllers (`ApiResponse`, `IActionResult`, raw DTOs, `ActionResult<T>`, `BaseMutationResponse`, bare `Task`) and read-only endpoints using `[HttpPost]`. Clients cannot rely on a uniform response contract; POSTed reads are uncacheable/non-idempotent.
- **Client↔endpoint drift and dead code.** The delete-module modal calls a commented-out endpoint (#228); the "Environments" nav points to a non-existent route; the export modal contains an unreachable XLF upload path. UI affordances exist for capabilities the backend does not currently serve.
- **Naming/hygiene debt (#229, #230, #231, #234, #235, #236).** `DeleteAsysnc` typo in two public interfaces across 24 sites; `Blocks.Genesis` namespace-squatting (upgrade-break risk); `ConfigConroller.cs` filename typo; `Cloud` vs `Clouds` in public URLs; committed build/scratch artifacts (`a.txt`, `.tmp`, `puku-embeddings.db`, `client/coverage/`, stale `Api.xml`); **no `.editorconfig`/ruleset/CONTRIBUTING** so none of this is CI-enforceable (#236 is the highest-leverage root cause).
- **Multi-tenancy correctness depends on `BlocksContext.TenantId`** for the authenticated paths, but the unauthenticated paths trust a query-string `projectKey` instead — two different tenant-resolution mechanisms coexist, and the weaker one is the leak.
- **No enforced review/quality gate.** AI output and hand edits can reach published files (including via auto-publish) with no approval step and a literal `[ KEY MISSING ]` placeholder shipping to end users.
- **Self-contained MongoDB store** (keys, languages, modules, glossaries, timelines, generated/exported files, webhook) rather than via the blocks-data gateway; whether this stays self-contained is undecided (Q-D1).

---

## 3. Suggested Changes — Prioritised

| Priority | Area/Feature | Suggested change | Why it matters | Rough effort | Ref |
|---|---|---|---|---|---|
| P1 | Access control / Runtime + Config + Language + Module | Authenticate the 4 open endpoints (`GetUilmFile`, `GetWebHook`, `Language.Gets`, `Module.Gets`) and add a `Program.cs` fallback-deny policy | Cross-tenant data read via a guessed `projectKey`; secret webhook config exposed | M | #227 |
| P1 | Permissions | Fix broken scopes: lowercase `assistant::gettranslationsuggestion`; restore `glossary::get-suggested-glossaries`; re-seed IAM | Mis-cased/commented scopes silently break or bypass authorization | S | #232 |
| P1 | AI auto-translation | Fix retry guard so a non-empty result on the final retry is returned, not discarded as `null` | Valid translations are silently lost, wasting an AI call and leaving keys untranslated | S | (found in review) |
| P1 | Keys | Add missing `return` to the 6 discarded-`BadRequest` guards | Null input falls through to services → inconsistent errors / NRE risk | S | #224 |
| P1 | Modules | Restore `Module.Delete` (scoped, with cascade) or remove the client delete UI | Delete-module modal 404s silently while appearing to work | M | #228 |
| P2 | Import/Export | Align import/export format lists; decide XLF: finish it or delete the dead upload path | Backend supports XLF but UI half-exposes it; vendor XLIFF round-trip blocked | M | #234, Q-B7 |
| P2 | Publish | Decide `[ KEY MISSING ]` vs default-language fallback; make configurable | Placeholder string ships to real end users | S | Q-A4 |
| P2 | Environments/migration | Build the migration trigger or hide the dead "Environments" nav link | Nav item resolves to no route; capability unreachable | M | Q-C4, Q-D3 |
| P2 | Language management | Enforce single-default on `Save` (not just `SetDefault`) | A plain Save can create a second default, breaking the source-language invariant | S | Q-A5 |
| P2 | API surface | Standardise the response envelope; make read endpoints `GET`; fix `getkeysbykeynames` scope | Uniform, cacheable, tool-mappable API contract | L | #233, #232 |
| P2 | Permissions | Add scopes to `[Authorize]`-only timeline/glossary reads | Inconsistent authz; no per-endpoint governance | S | — |
| P2 | Webhook | Fire webhook on per-key translate consumers (or document Translate-All-only) | "Notify on translate" contract is currently partial | S | — |
| P2 | Roles | Define a translator role (edit/translate, not publish/delete) | No least-privilege path for content editors | M | Q-D5 |
| P3 | Repo hygiene / naming | Add `.editorconfig`+ruleset; remove committed artifacts; fix `DeleteAsysnc`, `ConfigConroller`, `Cloud/Clouds`, `Blocks.Genesis` namespace | Makes every naming/hygiene fix CI-enforceable; prevents upgrade-break | M | #236, #235, #229, #230, #231, #234 |
| P3 | Worker | Add a job-status/failure surface for stuck async jobs | One-shot notifications hide failed translate/import jobs | M | — |
| P3 | AI/Glossary | Include glossary `AdditionalNote` in prompt; configurable retry backoff; define `Language` field use | Under-used glossary richness; 15s stalls on failing keys | S | Q-B6 |
| P3 | History | Operation-level rollback; "republish this version" from generation history; export retention policy | Finer audit/recovery; storage growth control | M | Q-B5 |

---

_Grounded in code verified on `inception`: all six controllers, `AssistantService`, `KeyManagementService`, `LanguageManagementService`, the seven worker consumers, the IAM seed (27 permissions), and the client router/nav/export/import modals. Open product questions (Q-*) reference the ProductSpec; ticket numbers reference open GitHub issues #224–#236._

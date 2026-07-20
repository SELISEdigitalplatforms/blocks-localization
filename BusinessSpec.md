# Blocks Localization (repo `blocks-localization`) — Business Specification

> **Naming note (undecided).** No product-owner decision has been recorded for this service (the authoritative decisions log for `blocks-localization` is empty — no answered tickets yet). The customer-facing product name is therefore **not yet decided**. Three names compete in the codebase and all refer to this one service:
> - **Blocks Localization** — the SPA/browser-tab title and the service identifier (`blocks-localization`); used as the working name in this spec.
> - **EuroLM / Eurolm** — the internal/legacy name: server namespaces (`Eurolm.DomainService`), message queues (`eurolm_*`), README title ("Blocks EuroLM"), worker `blocks-eurolm-worker`.
> - **UILM** — the name of the produced artifacts and API surface ("UILM file", API base aliased `UILM`, a sample area literally named "UILM Tool"); never expanded anywhere in code.
>
> This spec uses **Blocks Localization** throughout and treats EuroLM/UILM as internal names to be reconciled. Picking the canonical name (and retiring or defining the other two) is **Open Question OQ-1** below. Because there are no recorded decisions, every "decided" position in this document is stated as **derived from code** and marked **Open / undecided** where a business choice is genuinely unresolved.

---

## 1. Overview

Blocks Localization is the **translation-management service** of the SELISE Blocks platform. It gives a team one place to collect every piece of user-facing UI text for the apps they build on a Blocks project, store each string as a named **key**, translate that key into any number of **languages** (by hand, with an AI assistant, or via offline spreadsheet/XLIFF round-trips), and then **deliver** those translations to the running apps — either by the app pulling a compiled JSON dictionary or by an outbound webhook announcing that new translations are live. It exists so that multilingual UI text across many apps and many languages is managed centrally — with AI assistance, terminology control (glossaries), a full audit trail, and per-key rollback — instead of being scattered across each app's codebase as loose translation files.

---

## 2. Problem & Market Context

Teams that ship software to more than one language market face a recurring, compounding problem:

- **Translation strings are scattered.** Each app or codebase carries its own `.json` / `.resx` / `.po` / XLIFF files. There is no single source of truth, and the same term gets translated inconsistently across apps.
- **Adding a language is expensive and slow.** Every new locale means finding every string, exporting it, paying a translator, re-importing, and redeploying — per app.
- **Terminology drifts.** Brand names, product nouns, and acronyms get translated differently by different people or tools, hurting quality and trust.
- **No governance or recovery.** When a bad translation ships, there is rarely a clear audit trail of who changed what, or a safe way to roll a single string back.
- **Non-technical translators are locked out.** Editing strings often means editing source files in a repo, which content/localization managers cannot (and should not) do.

Blocks Localization addresses this for teams already building on SELISE Blocks: it centralizes strings per project, adds an AI first-pass to cut the cost of reaching many languages, enforces terminology through glossaries, keeps a change history with rollback, and supports professional/offline translation workflows through industry file formats (including XLIFF). The AI translation path calls an OpenAI chat-completions endpoint (`AiCompletionUrl` default `https://api.openai.com/v1/chat/completions`, low temperature `0.1` for deterministic output), positioning the product in the "AI-assisted localization / translation-management (TMS)" space rather than as a raw machine-translation API.

---

## 3. Value Proposition & Positioning

> **Positioning is not owner-decided** (no recorded decisions). The following is **derived from what the code actually does** and should be ratified. See OQ-2.

**What it is (derived):** a **project-scoped, AI-assisted translation-management system** built into the Blocks console — a central home for UI-string keys, their translations, terminology, and the compiled runtime dictionaries that consuming apps read.

**Core value pillars (each grounded in a real capability):**
- **Centralize** all UI text for a project's apps in one store, organized by **Module**, instead of per-codebase files.
- **Accelerate** reaching many languages with **AI auto-translation** (one key, selected keys, or all untranslated), seeded from the default/source language.
- **Keep terminology consistent** with **Glossaries** applied at three tiers (global / per-module / per-key) that steer the AI.
- **Support professional/offline translation** via export/import in `xlsx`, `csv`, `json`, and **`xlf` (XLIFF)** for agency hand-off.
- **Deliver to apps at runtime** via a compiled JSON dictionary per module per language (pull) and/or an outbound **webhook** (push).
- **Govern and recover** through a full per-key change **timeline** and **rollback**.

**What it is explicitly NOT (derived — confirm):**
- **Not the platform's monitoring/audit tool.** Its "Logs / Timeline" is a *business* audit of translation changes, not infrastructure monitoring; that is blocks-monitor's job.
- **Not a general content-management or copy-authoring system.** It manages *translations of keyed UI strings*, not marketing pages, blog content, or rich documents.
- **Not an end-user-facing surface.** End users of the built apps never open Blocks Localization; they only see its output rendered in their app.
- **Not (today) a consumer of the blocks-data gateway.** It owns its MongoDB collections directly rather than modelling strings as blocks-data Entities (see §6, OQ-8).
- **Not a standalone SaaS.** It is a per-project service inside the Blocks console, reached only through blocks-os with a Blocks project (tenant) context.

---

## 4. Target Customers & Personas

**Customer:** an organization building one or more applications on the SELISE Blocks platform that must ship UI in more than one language.

> **Primary persona is not owner-decided.** The code splits the work across a project's console personas, but the day-to-day hands-on user is a translator/content manager who has **no formalized persona or role** today. Naming the primary persona is OQ-3.

**Personas that apply:**

- **Translator / Localization / Content manager (the de-facto primary daily user — currently unformalized).** Edits string values, runs AI auto-translate, curates glossaries, and does offline export/import round-trips. Today this person operates through the same admin/developer surfaces; there is no reduced "translate-and-edit-but-not-publish/delete" role (OQ-4, OQ-5).
- **App developer (building on Blocks).** Sets up the structure and wires the app to consume translations: creates **Modules**, adds **Keys** whose `KeyName` matches the app's lookup identifier (with optional **Context** and **Routes**), bulk-imports existing translation files to seed keys, and integrates the app to fetch the generated JSON dictionary (`Key/GetUilmFile?projectKey&module&language`).
- **Project / tenant administrator.** Governs the language set and go-live: manages **Languages** and picks the **default (source) language**, configures the **webhook** endpoint + secret, triggers **Publish Changes** to compile runtime files, reviews the **Timeline** and performs **rollback**, and can **migrate** translations between projects/environments.
- **End user of the built apps — indirect only.** Never opens the tool; experiences its output. Where a key lacks a value for their language they may currently see the literal placeholder `[ KEY MISSING ]` (OQ-6 asks whether a smarter fallback, e.g. default-language text, is wanted).

---

## 5. Business Use Cases

- **Centralized multilingual UI text.** Manage every app's strings for a project in one store, organized by Module, instead of per-codebase files.
- **AI-accelerated first-pass translation.** Fill all missing values in bulk from the source language to lower the cost/time of reaching many locales; a human refines afterward.
- **Terminology consistency.** Constrain the AI with glossaries (brand terms, acronyms, abbreviations) at global / module / key scope so terms translate consistently across apps.
- **Professional / offline translation hand-off.** Export to `xlsx` / `csv` / `json` / **XLIFF**, hand to an internal translator or external agency, and re-import — vendors are an implied part of the loop (OQ-7 asks whether this is a supported promise).
- **Runtime delivery to apps.** Apps pull a ready-made JSON dictionary per language and/or an external system is notified via webhook when translations change ("go live").
- **Governance & recovery.** A full change history with per-key rollback supports review, accountability, and undoing bad translations.
- **Environment / project promotion.** Copy a project's Modules and Keys into another project (with optional overwrite) to stand up a new environment (dev → staging → prod) or clone a product's localization. *Gap:* this exists in the worker (`EnvironmentDataMigrationEvent` consumer) but **no UI entry point was found in this repo** (OQ-9).

---

## 6. Where it fits in the SELISE Blocks platform

Blocks Localization is a **per-project (per-tenant) service** that renders inside the Blocks console. Its screens live under `/app/services/…` (Translations, Modules, Glossary, Configuration), and every backend operation is scoped to the current project via `BlocksContext.GetContext().TenantId` (the `X-Blocks-Key` tenant key).

- **blocks-os (central console / control-plane).** Blocks Localization renders inside the OS console shell and is reached by opening a project in blocks-os and choosing its Translations / Modules / Glossary / Configuration menu items. Its **Modules** loosely correspond to the apps/areas a project contains. **Open boundary (OQ-10):** Modules resemble the apps/services blocks-os already tracks — whether adding an app in the console should auto-create a Module here, or the two lists stay independent, is undecided.
- **blocks-iam (identity & access).** Authentication is OIDC login via the Blocks client guards. Authorization is enforced per endpoint with `[ProtectedEndPoint("blocks-localization::<controller>::<action>")]` permissions — **27** endpoint permissions are seeded via `server/seed/localization-permissions.upsert.json` into the shared IAM permission collection (e.g. `blocks-localization::key::save`, `::key::translateall`, `::key::generateuilmfile`, `::key::rollback`, `::language::setdefault`, `::glossary::save`, `::config::savewebhook`). IAM decides who may edit, translate, publish, delete, or configure. The permission *taxonomy* here is `service::controller::action`, consistent with the platform standard.
- **blocks-data (dynamic-schema data gateway).** **Minimal / parallel today.** Blocks Localization manages its own MongoDB collections directly through its own repositories (keys, languages, modules, glossaries, timelines, generated files, exported files) rather than modelling strings as blocks-data Entities over GraphQL. It does depend on a **Storage** driver for saving/downloading exported/imported files. Whether it should stay self-contained long-term is OQ-8.
- **blocks-monitor (uptime monitoring).** **Not a runtime dependency.** Note the naming overlap: this product has its own "Logs / Timeline", but that is a *business audit trail of translation changes* (who changed which key when, with rollback) — it is distinct from blocks-monitor's infrastructure uptime monitoring.

---

## 7. Success Metrics / KPIs

> **Not owner-defined.** No KPIs are recorded; the following are proposed, each measurable from data the system already tracks. Ratifying the KPI set is OQ-11.

Candidate KPIs, grouped by value pillar:
- **Coverage / completeness** — % of keys fully translated across a project's active languages; count of keys showing `[ KEY MISSING ]` in a published file. (The UI already computes a per-key "Completeness"/"No translation" vs "Complete" state.) What "finished" means — every key × every language, or only shipped pages / market-relevant languages — is itself undecided (OQ-12).
- **Time-to-language / velocity** — elapsed time from adding a language to that language reaching a published file; number of languages live per project.
- **AI leverage** — share of translations produced by AI vs edited by a human; AI-translation volume (keys translated per auto-translate run). Requires distinguishing AI-authored from human-edited values in the timeline.
- **Terminology consistency** — number of glossaries in use and glossary coverage across modules; (qualitative) reduction in inconsistent term usage.
- **Governance** — number of rollbacks performed (a proxy for defect recovery); publish frequency and time-since-last-publish per module.
- **Adoption** — projects with Blocks Localization enabled; active editors per project.

---

## 8. Pricing, Packaging & Limits

- **Pricing & packaging:** **Open / undecided.** No pricing, plan, or entitlement logic exists in this repo. It is currently a per-project platform service gated only by IAM permissions.
- **Quotas / limits:** **Open / undecided.** No configurable limits on number of languages, keys, modules, glossaries, or file size were found. The only enforced constraint is per-endpoint IAM authorization (27 seeded permissions).
- **AI cost pass-through:** **Open / undecided.** AI translation calls an external OpenAI completions endpoint (`AiCompletionUrl`), which implies a real per-use cost, but there is **no metering, quota, or billing mechanism** for AI usage in the code. Whether AI translation is a metered/priced feature is unresolved (relates to OQ-11).

---

## 9. Scope & Non-Goals

> **No roadmap decisions are recorded.** The split below describes **what is built in this repo today** (effective v1 scope) versus **capabilities present but incomplete** and **plausible non-goals**. It should be ratified into an explicit v1 line (OQ-13).

**Built and working (effective v1 scope):**
- Language management (add / delete / set default source language).
- Translation keys: create/edit with per-language values, optional Context, Routes, glossary tags; single and bulk save/delete.
- Modules (named key groupings, internally "applications"); each publishes its own file.
- AI auto-translation for one key, selected keys, or all untranslated keys, glossary-steered.
- Glossaries at global / module / key tiers, plus a "suggested glossaries" matcher.
- Publish / generate: compile a JSON dictionary per module per language, versioned in generation history; fires webhook + notifications.
- Runtime consumption endpoints (`Key/GetUilmFile`, `Key/GetCloudUilmFile`).
- Import / export in `xlsx`, `csv`, `json`, `xlf` (XLIFF), with export history.
- Change history (timeline, grouped by operation) and per-key rollback.
- Webhook configuration (URL + secret + content-type).
- Asynchronous worker pipeline (`eurolm_*` queues) for long-running translate/publish/import/export/migrate operations, with in-app completion notifications.

**Present in code but incomplete / needs a decision (roadmap candidates, not clean v1):**
- **Environment/project data migration** — worker consumer exists; **no UI** in this repo (OQ-9).
- **XLIFF import parity** — backend can import `xlf` but the import UI reportedly advertises fewer formats than the backend accepts; the two lists should be reconciled (OQ-14).
- **Two publish paths** — a deliberate "Publish Changes" (all modules) coexists with an implicit auto-publish when a key is saved with `ShouldPublish=true` (single module). Which is the intended workflow, and whether quiet auto-publish risks premature go-lives, is undecided (OQ-15).
- **"Extension Sync" / external extension** — a notification implies an external "extension" consumer of translations that is **not in this repo**; its owner and contract are unknown (OQ-16).
- **AI review gate** — nothing forces human review/approval of AI output before publish; whether a review step should be mandatory is undecided (OQ-17).

**Likely non-goals (to confirm):**
- Serving translations to non-Blocks apps as a standalone TMS SaaS.
- Rich-content / document / marketing-copy management (this is keyed UI strings only).
- Being the platform's audit/monitoring system of record (that is blocks-monitor).
- Translation-memory / fuzzy-match reuse across projects beyond the AI + glossary path (none found).

---

## 10. Open Business Questions

Because **no product-owner decisions have been recorded for `blocks-localization`**, the questions below are unresolved and block a fully authoritative spec. They map to the analysis in `Guides/product-questions-blocks-localization.md`.

- **OQ-1 — Canonical product name.** Which of **Blocks Localization / EuroLM / UILM** is the customer-facing name, and should the other two be retired or given a defined meaning? *(questions A1)*
- **OQ-2 — Ratify positioning & the headline problem.** Confirm the one-sentence value (cost reduction vs more languages faster vs terminology consistency vs centralization) and the "what it is NOT" list in §3. *(A/C: C1)*
- **OQ-3 — Primary persona & whether a simplified translator experience is needed** vs the current admin/developer console surface. *(B1)*
- **OQ-4 — Consistent terminology for users:** what to call the translatable item ("key") and each language's value ("resource") given the menu says "Translations". *(A2)*
- **OQ-5 — Roles:** should translators get a limited role (edit + translate, but not publish/delete) distinct from admins/developers? It does not exist today and must be defined if wanted. *(D5)*
- **OQ-6 — Missing-translation fallback:** is `[ KEY MISSING ]` an acceptable live fallback, or should it show default-language text / never reach users? *(A4)*
- **OQ-7 — External translation vendors:** are outside agencies (XLIFF hand-off) an intended, supported part of the workflow, and what does a smooth round-trip need? *(C3, C2)*
- **OQ-8 — Data ownership boundary with blocks-data:** stay self-contained, or eventually model strings/history through the data gateway? *(D1)*
- **OQ-9 — Environment/project migration:** what business scenario (new environment vs cloning), is it self-service, and where should its (currently missing) UI live? *(C4, D3)*
- **OQ-10 — Module vs app boundary with blocks-os:** should adding an app in the console auto-create a Module, or are the lists maintained separately? What does a Module represent (whole app / feature area / folder)? *(A3, D3)*
- **OQ-11 — Success metrics & AI metering:** ratify the KPI set (§7) and decide whether AI translation usage is metered/priced. *(new; relates to §8)*
- **OQ-12 — Definition of "finished":** every key × every language, or only shipped pages / market-relevant languages — determines what "Completeness" should measure and warn on. *(C5)*
- **OQ-13 — Explicit v1 scope line vs roadmap** for the "incomplete" capabilities in §9. *(scope)*
- **OQ-14 — Import/export format parity:** which formats should be sendable and re-importable, and should the export and import lists match (backend accepts `xlf` that the import UI may not advertise)? *(B7)*
- **OQ-15 — Publish model:** should publishing always be one deliberate all-at-once action, or is per-key auto-publish (`ShouldPublish=true`) intended? Risk of premature go-live. *(B4)*
- **OQ-16 — External "extension" & webhook consumers:** what systems consume translations this way, who owns the integration, and is it a core promise or an optional add-on? *(D4, B3)*
- **OQ-17 — AI review gate:** must AI output be human-reviewed before it goes live? Nothing enforces it today. *(B2)*
- **OQ-18 — Delivery default (pull vs push):** is the app pulling the JSON file the standard path with the webhook as optional push, or both first-class? *(B3)*
- **OQ-19 — Glossary UX & trust:** how are users expected to build/apply the three glossary tiers, and how much should the AI be trusted to auto-pick terms via "suggested glossaries"? *(B6)*
- **OQ-20 — History screens:** do the change timeline and export history overlap, and what decisions should users make from each? *(B5)*
- **OQ-21 — Pricing & limits** (§8) are entirely undecided: plan/packaging, quotas on languages/keys/modules, and AI-cost handling.

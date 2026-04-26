# UILM React hub

Standalone **Vite + React + TypeScript** app aligned with [Staff+ rules](../../rules/frontend-staff-plus.mdc).

## Canonical docs


| Doc                                                                                                       | Role                                                       |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Spec (design)](../../../../docs/superpowers/specs/2026-04-10-uilm-react-frontend-design.md)              | Stack, platform model, env, ui-kits sync                   |
| [Plan (tasks)](../../../../docs/superpowers/plans/2026-04-10-uilm-react-scaffold.md)                      | Checklist / handoff                                        |
| [Localization spec](../../../../docs/superpowers/specs/2026-04-11-uilm-react-localization-design.md)      | Embedded UILM in SPA (no `@blocks-localization` submodule) |
| [Localization plan](../../../../docs/superpowers/plans/2026-04-11-uilm-react-localization-integration.md) | Implementation checklist                                   |


## Localization (UILM) in this app

- **Routes:** `/services/language` (table), `configure`, `export-history`, `logs` (stub — LMT not bundled), `translations/new-key`, `translations/:id` — aligned with the monolith `services/language/*` paths.
- **Code:** `src/features/uilm/` — HTTP via `idpRequest`/`idpPostJson`/`idpDelete` to `/uilm/v1/*`; **project key** in the top bar (persisted) or optional default from **`BLOCKS_UILM_PROJECT_KEY`** in repo-root `.env`.
- **Not ported:** async export download (SignalR + storage), import pre-sign upload, AI translate modals, LMT log viewer — same gaps as documented in the localization spec.

## Commands

```bash
cd client
npm install
npm run dev        # vite --host dev-cloud.seliseblocks.com --port 4001 (see package.json)
npm run dev:local  # http://127.0.0.1:4001 — no hosts entry for dev-cloud
npm run sync:ui    # re-copy parent ui-kits → src/platform/ui/components
npm run build
```

## Environment

`vite.config.ts` sets `envDir` to the **monolith repo root** and **`envPrefix: ['BLOCKS_']`**. Set client variables as **`BLOCKS_*`** in the root `.env` (see `client/.env.example` and `src/config/env.ts`). In dev, check the browser console for `[client] env from repo-root .env`.

## UI sync

Source of truth for visuals: `../src/components/ui-kits`. After changing upstream components, run `npm run sync:ui` and fix any merge issues.
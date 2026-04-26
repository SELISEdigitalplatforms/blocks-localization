# Blocks shell parity (UILM React)

SPA routes and layouts mirror the monolith **console header**, **create-project** flow, **project overview** (environments + sidebar), and **dashboard** shell with a **narrow sidebar** (Localization). A **project card** on `/console` opens **`/project-overview/environments`** (with tenant/project store set). **`/dashboard`** redirects to **`/services/language`** (environment overview was removed from UILM React).

## Code map

| Concern | Location |
|---------|----------|
| Route tree | [`src/routing/routes/index.ts`](../../../src/routing/routes/index.ts) |
| Console + create layout | [`src/layouts/console-shell-layout.tsx`](../../../src/layouts/console-shell-layout.tsx), [`console-header.tsx`](../../../src/layouts/shell/console-header.tsx) |
| Dashboard layout + guard | [`dashboard-shell-layout.tsx`](../../../src/layouts/dashboard-shell-layout.tsx), [`src/routing/guards/dashboard-guard.tsx`](../../../src/routing/guards/dashboard-guard.tsx) |
| Create project | [`src/features/create-project/`](../../../src/features/create-project/) |
| `/dashboard` | Redirect → `/services/language` in [`dashboard.routes.ts`](../../../src/routing/routes/dashboard.routes.ts) |
| Optional project overview | [`src/layouts/project-overview-shell-layout.tsx`](../../../src/layouts/project-overview-shell-layout.tsx), [project-overview-parity.md](./project-overview-parity.md) |

## Canonical spec / plan (repo root)

- [`docs/superpowers/specs/2026-04-11-uilm-react-blocks-shell-design.md`](../../../../docs/superpowers/specs/2026-04-11-uilm-react-blocks-shell-design.md)
- [`docs/superpowers/plans/2026-04-11-uilm-react-blocks-shell.md`](../../../../docs/superpowers/plans/2026-04-11-uilm-react-blocks-shell.md)

## Verify

```bash
cd uilm-react && npm run lint
```

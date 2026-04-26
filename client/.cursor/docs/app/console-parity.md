# Console parity (UILM SPA vs Next.js identifier)

Monolith reference: [`src/modules/identifier/pages/console/`](../../../../src/modules/identifier/pages/console/) and [`identifier/pages/`](../../../../identifier/pages/).

**Implemented in `uilm-react`:** [`ConsolePage`](../../../src/features/console/pages/console-page.tsx) → [`ConsoleShell`](../../../src/features/console/components/console-shell.tsx) (`SelfProject` + `DefaultDocStrip`), same API as the Next app (`GET /identifier/v1/Project/Gets`). **Create project** uses the UILM stepper; deep links use [`mainAppPath`](../../../src/features/console/lib/main-app-url.ts) (`NEXT_PUBLIC_APP_URL` / `VITE_APP_URL`) when the flow only exists in the Next app.

**Project overview (`/project-overview/*`):** [`ProjectOverviewShellLayout`](../../../src/layouts/project-overview-shell-layout.tsx) + [`ConsoleHeader`](../../../src/layouts/shell/console-header.tsx).

| Route | UILM page | API / notes |
|-------|-----------|-------------|
| `environments` | [`ProjectOverviewEnvironmentsPage`](../../../src/features/console/pages/project-overview-environments-page.tsx) | `GET /identifier/v1/Project/Gets`; owner gate via `POST /identifier/v1/People/Gets` (peek); **New environment** → handoff dialog to main app |
| `people` | [`ProjectOverviewPeoplePage`](../../../src/features/console/pages/project-overview-people-page.tsx) | `POST /identifier/v1/People/Gets`, invite + row actions (resend invite, resend activation, transfer) |
| `people/:userId` | [`ProjectOverviewPeopleDetailPage`](../../../src/features/console/pages/project-overview-people-detail-page.tsx) | IAM `GetUser`, people row by email, `Project/Gets`; tabs Details / Environments / Devices (`?tab=`) |
| `repositories` | [`ProjectOverviewRepositoriesPage`](../../../src/features/console/pages/project-overview-repositories-page.tsx) | `GET /identifier/v1/Project/GetAsset` (paged + search); **Add** → handoff (GitHub OAuth lives in monolith) |
| `settings` | [`ProjectOverviewSettingsPage`](../../../src/features/console/pages/project-overview-settings-page.tsx) | `GET /identifier/v1/Project/Gets` + `POST /identifier/v1/Project/UpdateTenantGroup`; edit if `createdBy` matches `GET /idp/v1/Iam/GetUser` `itemId` |
| `dashboard` | `Navigate` in [`dashboard.routes.ts`](../../../src/routing/routes/dashboard.routes.ts) | **`/dashboard` redirects to `/services/language`** (environment overview UI removed from UILM React). |

**Design/spec history:**

- [`docs/superpowers/specs/2026-04-10-console-identifier-uilm-react-sync-design.md`](../../../../docs/superpowers/specs/2026-04-10-console-identifier-uilm-react-sync-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-project-overview-screens-parity-design.md`](../../../../docs/superpowers/specs/2026-04-11-uilm-react-project-overview-screens-parity-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-environment-overview-dashboard-design.md`](../../../../docs/superpowers/specs/2026-04-11-uilm-react-environment-overview-dashboard-design.md)

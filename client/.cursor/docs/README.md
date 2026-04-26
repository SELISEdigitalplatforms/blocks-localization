# Cursor documentation index

Project-specific docs for agents and operators, kept under `.cursor/docs/`.

| Hub | Path | Topics |
|-----|------|--------|
| **App shell** | [app/README.md](./app/README.md) | `src/app` layouts, route groups, middleware, guards |
| **UILM SPA routes** | [app/spa-routing.md](./app/spa-routing.md) | `createBrowserRouter`, route table, guards |
| **RR navigation** | [app/react-router-navigating.md](./app/react-router-navigating.md) | `Link` / `NavLink` / `useNavigate` conventions |
| **Skeleton loading** | [app/skeleton-loading-boneyard.md](./app/skeleton-loading-boneyard.md) | `Loader2` / platform skeletons (no `boneyard-js` in this package) |
| **Console vs monolith** | [app/console-parity.md](./app/console-parity.md) | `/console` stub vs identifier grid; spec + plan links |
| **Blocks shell (UILM)** | [app/blocks-shell-parity.md](./app/blocks-shell-parity.md) | Console header, create-project, `/dashboard` shell, filtered sidebar |
| **Auth (UILM SPA)** | [auth/auth-module-layout.md](./auth/auth-module-layout.md) | `src/features/auth` — model, services, components, pages |
| **Refactor / dead code (UILM)** | [uilm-react/refactor-clean.md](./uilm-react/refactor-clean.md) | knip, depcheck, SAFE/CAUTION/DANGER, `code-architect` gate |
| **IDP** | [idp/README.md](./idp/README.md) | `@blocks-idp/*`, route → component map, MFA/OIDC notes |

## Canonical specs (repo)

- [`docs/superpowers/specs/2026-04-10-src-app-shell-design.md`](../../../docs/superpowers/specs/2026-04-10-src-app-shell-design.md)
- [`docs/superpowers/specs/2026-04-10-idp-architecture-design.md`](../../../docs/superpowers/specs/2026-04-10-idp-architecture-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-createbrowserrouter-design.md`](../../../docs/superpowers/specs/2026-04-11-uilm-react-createbrowserrouter-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-routing-folders-design.md`](../../../docs/superpowers/specs/2026-04-11-uilm-react-routing-folders-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-auth-folder-structure-design.md`](../../../docs/superpowers/specs/2026-04-11-uilm-react-auth-folder-structure-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-react-router-navigating-design.md`](../../../docs/superpowers/specs/2026-04-11-uilm-react-react-router-navigating-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-refactor-clean-architecture-design.md`](../../../docs/superpowers/specs/2026-04-11-uilm-react-refactor-clean-architecture-design.md)
- [`docs/superpowers/specs/2026-04-10-console-identifier-uilm-react-sync-design.md`](../../../docs/superpowers/specs/2026-04-10-console-identifier-uilm-react-sync-design.md)
- [`docs/superpowers/specs/2026-04-11-uilm-react-blocks-shell-design.md`](../../../docs/superpowers/specs/2026-04-11-uilm-react-blocks-shell-design.md)

## NPM helpers

```bash
npm run idp:manifest   # idp file inventory → .cursor/docs/idp/component-manifest.json
npm run idp:route-map  # @blocks-idp page imports → .cursor/docs/idp/route-map.md
```

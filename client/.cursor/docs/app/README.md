# App shell documentation hub

Quick reference for **Next.js App Router** under `src/app/`: layouts, route groups, middleware, and auth guards. Use this together with the IDP hub when mounting `@blocks-idp` pages.

## Docs in this folder

| Doc | Purpose |
|-----|---------|
| [layout-tree.md](./layout-tree.md) | Route groups, nesting, example URLs |
| [guards-and-middleware.md](./guards-and-middleware.md) | `PublicGuard` / `ProtectedGuard`, `x-current-path`, SSO POST handling |
| [how-to-add-a-route.md](./how-to-add-a-route.md) | Where to add `page.tsx` and which layout applies |
| [skeleton-loading-boneyard.md](./skeleton-loading-boneyard.md) | Spinners / skeleton patterns (no `boneyard-js` dependency) |

## Canonical spec and plan

- [`docs/superpowers/specs/2026-04-10-src-app-shell-design.md`](../../../docs/superpowers/specs/2026-04-10-src-app-shell-design.md)
- [`docs/superpowers/plans/2026-04-10-src-app-shell-docs.md`](../../../docs/superpowers/plans/2026-04-10-src-app-shell-docs.md)

## Related hubs

- [IDP package (`@blocks-idp`)](../idp/README.md) — domain UI, APIs, [route map](../idp/route-map.md)

## Regenerate IDP route table

When you add or change `page.tsx` files that import `@blocks-idp`:

```bash
npm run idp:route-map
```

## Cursor rules

- [`.cursor/rules/src-app.mdc`](../../rules/src-app.mdc) — `src/app/**`, `src/middleware.ts`

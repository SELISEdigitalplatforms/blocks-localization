# IDP documentation hub

Quick reference for the `idp/` package (`@blocks-idp/*`) in this Next.js app.

## Start here

| Doc | Purpose |
|-----|---------|
| [App shell (layouts, guards)](../app/README.md) | How `src/app` route groups wrap IDP and other pages |
| [architecture.md](./architecture.md) | Boundaries, domains, how pages mount |
| [route-map.md](./route-map.md) | Every App Router `page.tsx` → IDP component |
| [corner-cases.md](./corner-cases.md) | MFA, OIDC, captcha, HTTP client, tenant |
| [shadcn-and-ui-kits.md](./shadcn-and-ui-kits.md) | Where UI primitives live |
| [component-manifest.json](./component-manifest.json) | Generated list of all `idp/**/*.tsx` + barrels |

## Canonical spec

Long-form design (architecture, extension guidelines, inventory strategy):

- [`docs/superpowers/specs/2026-04-10-idp-architecture-design.md`](../../../docs/superpowers/specs/2026-04-10-idp-architecture-design.md)

## Implementation plan (checklist)

- [`docs/superpowers/plans/2026-04-10-idp-docs-and-cursor-hub.md`](../../../docs/superpowers/plans/2026-04-10-idp-docs-and-cursor-hub.md)

## Regenerate manifest and route map

After adding or renaming IDP files:

```bash
npm run idp:manifest
```

After adding or changing `src/app/**/page.tsx` that import `@blocks-idp`:

```bash
npm run idp:route-map
```

Commit generated files when the change is intentional.

## Cursor rules

- [`.cursor/rules/idp.mdc`](../../rules/idp.mdc) — agent guidance scoped to `idp/**`

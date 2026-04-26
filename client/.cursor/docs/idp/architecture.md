# IDP architecture (digest)

**Canonical document:** [`docs/superpowers/specs/2026-04-10-idp-architecture-design.md`](../../../docs/superpowers/specs/2026-04-10-idp-architecture-design.md)

## One-line summary

`idp/` is an in-repo domain package for authentication, IAM, MFA admin, and CAPTCHA admin; it is imported as `@blocks-idp/*` and **depends on** the host app (`@/components`, `@/lib`, `@/store`, identifier modules).

## Domains

| Folder | Responsibility |
|--------|----------------|
| `idp/authentication/` | Login, signup, OIDC flows, password reset, auth/MFA checks, authentication admin UI |
| `idp/iam/` | Users, roles, permissions, organizations, profile |
| `idp/mfa/` | MFA service configuration and logs |
| `idp/captcha/` | CAPTCHA configuration and logs |

## How a screen ships

1. Build the UI in `idp/...` (usually a named export, often `"use client"`).
2. Mount it from `src/app/.../page.tsx` with a single primary import from `@blocks-idp/...`.
3. Call APIs through **services** + **React Query hooks**; paths use `API_BASES` (`/idp/v1`, `/mfa/v1`, cloud configuration, identifier, etc.).

## Where to look

- **Route wiring:** [route-map.md](./route-map.md)
- **Every TSX file:** [component-manifest.json](./component-manifest.json) (`npm run idp:manifest`)
- **UI primitives:** [shadcn-and-ui-kits.md](./shadcn-and-ui-kits.md)
- **Edge behavior:** [corner-cases.md](./corner-cases.md)

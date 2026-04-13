# `src/features/auth/` module layout (UILM React)

IDP-facing authentication UI and API helpers for the Vite SPA. **Route definitions** stay in [`src/routing/`](../app/spa-routing.md); this folder is domain logic + components only (feature slice; see [Staff+ frontend rules](../../rules/frontend-staff-plus.mdc)).

## Directory map

| Folder | Responsibility |
|--------|----------------|
| **`model/`** | Zustand store (`auth-store`), shared enums/types, sign-in zod schema |
| **`services/`** | REST path constants (`endpoints`) and IDP client functions (`auth-api`) |
| **`assets/`** | Static path maps (e.g. SSO button images via `publicAsset`) |
| **`utils/`** | Pure helpers (URL sanitize, signup zod) |
| **`hooks/`** | Client hooks (`useSsoActivation`, `useResendMfaOtp`, `usePrefersDark`) |
| **`components/`** | Reusable auth UI (shell, forms, SSO grid, MFA OTP, reCAPTCHA) |
| **`pages/`** | Composed flows used inside route pages: `Signin`, `Signup` |

Imports are explicit (no barrel `index.ts`): e.g. `@/features/auth/services/auth-api`, `@/features/auth/model/types`.

## Related

- [SPA routing](../app/spa-routing.md)
- Monolith parity: `idp/authentication/` (Next app)
- Spec: [`docs/superpowers/specs/2026-04-11-uilm-react-auth-folder-structure-design.md`](../../../../docs/superpowers/specs/2026-04-11-uilm-react-auth-folder-structure-design.md)

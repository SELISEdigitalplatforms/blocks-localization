# UILM React — IDP / auth port conventions

Use when extending authentication in `uilm-react` without pulling `@blocks-idp` or Next.js.

## Principles

- **API paths** mirror `API_BASES.IDP` from the monolith (`/idp/v1/...`), prefixed by `env.apiBaseUrl`.
- **Headers:** Always send `X-Blocks-Key` from `env.xBlocksKey` for IDP calls (via `idpRequest`).
- **Cookies:** Use `credentials: "include"` on all IDP `fetch` calls.
- **Errors:** Failed responses become `HttpError` with a flat `errors` record; use `isErrorWithErrors` + `showErrorToast` like the Next app.
- **Guards:** `PublicRoute` skips redirect when URL has both `code` and `state` (SSO callback). `ProtectedRoute` mirrors `ProtectedGuard`.
- **Assets:** PNG/SVG live under `uilm-react/public/` (mirror monolith `public`). After clone or if images 404, run `npm run sync:assets` from `uilm-react/`. In code, use `publicAsset('assets/images/...')` from `@/lib/public-asset` (not raw `/assets/...`) so Vite `base` is respected.

## Where code lives

- HTTP: `src/platform/api/idp-http.ts`
- Auth domain: `src/features/auth/` — layered layout (`model/`, `services/`, `components/`, `pages/`, …); see [auth-module-layout.md](./auth/auth-module-layout.md)
- UI kit imports: `@/platform/ui/...`

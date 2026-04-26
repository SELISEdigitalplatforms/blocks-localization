# How to add a route

## uilm-react (Vite SPA)

This package is **not** the Next.js App Router. Add or adjust routes under **`src/routing/routes/`** (import new pages into the right fragment, e.g. `public.routes.ts` or `language.routes.ts`), composed by **`getAppRouteTree()`** in **`src/routing/routes/index.ts`**. Guards live in **`src/routing/guards/`**; wrap pages or layouts with `PublicRoute` / `ProtectedRoute` as today.

- Full table and conventions: [spa-routing.md](./spa-routing.md)
- React Router reference: [Route object](https://reactrouter.com/start/data/route-object)

---

## Next.js monolith (`src/app`)

## 1. Pick the route group

| Need | Typical folder under `src/app` |
|------|--------------------------------|
| Logged-out auth marketing (login/signup) | `(public)/(auth)/...` |
| Other public pages (activate, forgot password) | `(public)/...` (or `(auth)` if sharing that layout) |
| Transitional screens (MFA check, password success) | `(internal)/...` — **check** root `internalRoutes` in `layout.tsx` does not redirect your path to `/login` |
| OIDC embedded flows | `(un-guard)/oidc/...` |
| Main product (sidebar + services) | `(main)/(home)/...` |
| Console / project overview / profile | `(main)/(console)/...` |
| Dashboard header without full home chrome | `(main)/(with-header)/...` |
| Minimal wizard-style flow | `(main)/(plain)/...` or a nested `layout.tsx` |

Match **sibling routes** that behave like your feature (guards, chrome).

## 2. Add `page.tsx`

- Default export the page component (often a thin wrapper).
- Prefer **one** primary import from a domain package (`@blocks-idp`, `@blocks-*`, `@/modules/...`).
- Use server components by default; add `"use client"` on the leaf (or a small wrapper) if you need hooks or browser APIs.

## 3. Middleware and root layout

- If you rely on `x-current-path` in root layout, middleware already sets it—no change usually needed.
- Add entries to `middleware.ts` **redirectPath** (or dynamic rules) when replacing old URLs.

## 4. IDP pages

If you import `@blocks-idp`:

1. Follow the same route group as similar screens (see [route-map](../idp/route-map.md)).
2. Regenerate the map: `npm run idp:route-map`.
3. Read [IDP architecture](../idp/architecture.md) for hooks, services, and `@/` dependencies.

## 5. Verify

- `npm run lint`
- Manually hit the URL: confirm guard behavior (logged in vs out) and layout chrome.

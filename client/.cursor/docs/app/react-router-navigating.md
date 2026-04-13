# React Router — navigating (uilm-react)

Official guide: [Navigating](https://reactrouter.com/start/framework/navigating) (React Router v7 docs).

This app uses **`react-router-dom` ^7.6** with **`createBrowserRouter`** and **`RouterProvider`** ([route objects / Data configuration](https://reactrouter.com/start/data/route-object)).

**Imports:** The [Navigating](https://reactrouter.com/start/framework/navigating) examples use `import { Link } from "react-router"`. In a **Vite browser SPA**, import DOM components and hooks from **`react-router-dom`** (same APIs, correct bundle). Example: [`key-detail-page.tsx`](../../../src/features/uilm/pages/key-detail-page.tsx) — `Link` + `useParams`.

**Where to verify in this repo (review / refactor-clean):**

- **Allowed in app code:** `from "react-router-dom"` only for `Link`, `NavLink`, `Navigate`, hooks (`useNavigate`, `useParams`, …), and `createBrowserRouter` / `RouterProvider` / route types as needed.
- **Disallowed in `src/`:** bare `from "react-router"` — use the DOM package so the browser build resolves the right entry. (Framework-only server code would be different; this SPA has none.)
- **Quick check** from repo root: `rg 'from [\"\']react-router[\"\']' uilm-react/src` should return **no matches**; `rg 'react-router-dom' uilm-react/src` lists all legitimate imports.

## Quick mapping

| API | Use when | Examples in this repo |
|-----|----------|------------------------|
| **`Link`** | User explicitly follows a hyperlink | Sign-in/up footers, console → UILM, [`KeyDetailPage` back link](../../../src/features/uilm/pages/key-detail-page.tsx) (`Button asChild` + `Link`) |
| **`useParams`** | Read dynamic **`:segment`** from the matched route | `KeyDetailPage`: `useParams<{ id: string }>()` for `translations/:id` |
| **`NavLink`** | Need **active** (and optional **pending**) UI for the current route | [`UilmNav`](../../../src/features/uilm/components/uilm-nav.tsx) |
| **`Navigate`** | Declarative redirect in render | [`root-fallback.routes.tsx`](../../../src/routing/routes/root-fallback.routes.tsx), MFA page without `mfa_id` |
| **`useNavigate`** | Navigation **after** async work, or **not** from a direct click | Sign-in/MFA success, SSO hook, `PublicRoute` / `ProtectedRoute` redirects |
| **`redirect()`** | Inside a route **`loader`** or **`action`** | Not used yet; optional if we move auth checks into Data APIs |

The docs recommend treating **`useNavigate` as uncommon**: prefer `Link` / `NavLink` for real navigation controls. **`useNavigate` is appropriate here** for mutations (login, MFA verify, SSO callback) and guard `useEffect` redirects.

## Framework-only pieces

Full **Framework mode** (file-based routes, server adapters, `react-router.config.ts`) is **out of scope** for this Vite SPA. Ignore doc sections that assume Remix-style route modules unless we adopt them.

## Related

- [spa-routing.md](./spa-routing.md) — route tree and guards
- Spec: [`docs/superpowers/specs/2026-04-11-uilm-react-react-router-navigating-design.md`](../../../../docs/superpowers/specs/2026-04-11-uilm-react-react-router-navigating-design.md)

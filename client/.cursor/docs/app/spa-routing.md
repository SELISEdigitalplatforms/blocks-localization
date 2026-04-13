# uilm-react SPA routing (Vite)

This app uses React Router v7 **Data mode** configuration: **`createBrowserRouter`** + **`RouterProvider`**, not `BrowserRouter` + `<Routes>`.

## Folder layout (`src/routing/`)

| Path | Purpose |
|------|---------|
| [`src/routing/app-router.ts`](../../../src/routing/app-router.ts) | `export const appRouter = createBrowserRouter(getAppRouteTree())` |
| [`src/routing/routes/index.ts`](../../../src/routing/routes/index.ts) | `getAppRouteTree()` — composes route fragments |
| [`src/routing/routes/public.routes.ts`](../../../src/routing/routes/public.routes.ts) | Auth-marketing / public paths (login, signup, MFA, stubs) |
| [`src/routing/routes/console.routes.ts`](../../../src/routing/routes/console.routes.ts) | `/console` |
| [`src/routing/routes/language.routes.ts`](../../../src/routing/routes/language.routes.ts) | `/services/language` + nested UILM pages |
| [`src/routing/routes/root-fallback.routes.tsx`](../../../src/routing/routes/root-fallback.routes.tsx) | `/` and `*` → login |
| [`src/routing/routes/stubs.tsx`](../../../src/routing/routes/stubs.tsx) | Thin stub shells for SSO / forgot-password |
| [`src/routing/guards/public-route.tsx`](../../../src/routing/guards/public-route.tsx) | Redirect authenticated users away (except SSO callback query) |
| [`src/routing/guards/protected-route.tsx`](../../../src/routing/guards/protected-route.tsx) | Redirect unauthenticated users to `/login` |
| [`src/app/App.tsx`](../../../src/app/App.tsx) | `AppProviders`, `RootMeta`, `RouterProvider`, `Toaster` |

Upstream reference: [Route object](https://reactrouter.com/start/data/route-object) (React Router docs).

**Navigation UX:** When to use `Link`, `NavLink`, `Navigate`, vs `useNavigate` — [react-router-navigating.md](./react-router-navigating.md) (maps [Navigating](https://reactrouter.com/start/framework/navigating) to this SPA).

## Route table (snapshot)

| Path | `Component` | Notes |
|------|-------------|--------|
| `/login` | `LoginPage` | Wrapped with `PublicRoute` inside page |
| `/console` | `ConsolePage` | `ProtectedRoute` inside page |
| `/services/language` | `LanguageShell` | Parent; **`ProtectedRoute`** wraps shell → **unauthenticated users are sent to `/login`** before any UILM UI renders |
| `/services/language` (index) | `LanguageWorkspacePage` | Nested |
| `/services/language/configure` | `ConfigurePage` | Nested |
| `/services/language/export-history` | `ExportHistoryPage` | Nested |
| `/services/language/translations/new-key` | `NewKeyPage` | Nested |
| `/services/language/translations/:id` | `KeyDetailPage` | Nested |
| `/mfa-check` | `MfaCheckPage` | `PublicRoute`; requires `mfa_id` query |
| `/sso-activate` | `SsoActivateStubPage` | Thin `StubPage` wrapper |
| `/forgot-password` | `ForgotPasswordStubPage` | Thin `StubPage` wrapper |
| `/signup` | `SignupPage` | |
| `/signup-email-sent` | `SignupEmailSentPage` | |
| `/` | `RootLoginRedirect` | `Navigate` → `/login` |
| `*` | `RootLoginRedirect` | unknown → `/login` |

## Guards

This SPA does **not** use Next.js middleware. Auth behavior lives in **`src/routing/guards/`** (client-side, `useAuthStore` + `useNavigate`). **`LanguageShell`** wraps content in **`ProtectedRoute`**, so **`/services/language` and all nested paths require login.**

See also [guards-and-middleware.md](./guards-and-middleware.md) for conceptual parity with the monolith (Next).

## Follow-ups (optional)

- Add **`lazy`** on heavy routes to reduce the main bundle (see React Router `lazy` on route objects).
- Introduce **`loader`s** only when you want data tied to navigation (TanStack Query remains the default for client data).

# Guards and middleware

## Client guards

**File:** `src/components/auth/auth-guard.tsx`

### `PublicGuard`

Used by `(public)/layout.tsx` and `(internal)/layout.tsx`.

- Renders **nothing** (`null`) while not mounted, or while the user is **authenticated** and the URL is **not** an SSO callback (`code` and `state` query params both present).
- After mount, if the user is authenticated and not in the SSO callback case, navigates to **`/console`**.
- **Intended use:** pages that should only be visible to **logged-out** users (login/signup) or special cases where SSO must finish on `/login` before redirect.

### `ProtectedGuard`

Used by `(main)/layout.tsx`.

- Renders **nothing** until mounted and **authenticated**; otherwise redirects to **`/login`**.
- **Intended use:** the entire authenticated product shell under `(main)`.

## Middleware

**File:** `src/middleware.ts`

### `x-current-path`

Every request gets `request.headers` updated with `x-current-path` set to the request pathname. The **root** `src/app/layout.tsx` reads this in a server component to implement `internalRoutes` redirects (see below).

### Apple SSO `POST /login`

Identity providers using `response_mode=form_post` POST `code` and `state` to `/login`. Middleware reads the body, then issues a **302** redirect to `GET /login?code=...&state=...` so the App Router page can run existing client SSO logic. **Do not change to 307** (would preserve POST and can loop).

### Legacy and canonical URL redirects

- Static `redirectPath` map: exact pathname → canonical path.
- Dynamic regex rules for some `/devops/repo/...` and `/ai/...` paths.

Details live in source; extend there when deprecating URLs.

## Root layout: `internalRoutes`

**File:** `src/app/layout.tsx`

If `headers().get("x-current-path")` exactly matches one of:

- `/activate-success`
- `/signup-email-sent`
- `/forgot-email-sent`
- `/invitation/result`
- `/oidc/permission`

…the server runs **`redirect("/login")`** before segment layouts render.

### Tension with `(internal)`

Those paths overlap files under `src/app/(internal)/`, which uses `PublicGuard` for transitional screens. **Observed behavior:** the root redirect wins, so those five URLs never render their page content in normal flow. Other `(internal)` routes (e.g. `/mfa-check`, `/reset-password-success`) are **not** in this list.

**Maintainership:** Treat as legacy, intentional lock-down, or bug—reconcile with product and update `internalRoutes` or remove dead pages.

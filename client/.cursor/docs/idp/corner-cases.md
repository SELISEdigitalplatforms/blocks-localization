# IDP corner cases and edge behavior

Code references are from the repo root.

## MFA after password login

- **Where:** [`idp/authentication/pages/login/signin-form.tsx`](../../../idp/authentication/pages/login/signin-form.tsx)
- **Behavior:** If `useSigninByEmail` resolves with `enable_mfa`, the client navigates to `/mfa-check?mfa_id=...&mfa_type=...` instead of `setAuthenticated()` and `/console`.
- **Verify:** [`idp/authentication/services/auth.service.ts`](../../../idp/authentication/services/auth.service.ts) — `verifyMfa` uses `grant_type=mfa_code` on the same token endpoint as password grant.

## Captcha on repeated login attempts

- **Where:** `signin-form.tsx`
- **Behavior:** When `submitCount >= 3`, reCAPTCHA v2 is rendered; the submit button stays disabled while captcha is required and `token` is empty. Site key from `NEXT_PUBLIC_GOOGLE_SITE_KEY`; theme from `next-themes`.

## OIDC URL parameters and branding

- **Where:** [`idp/authentication/utils/oidc-utils.ts`](../../../idp/authentication/utils/oidc-utils.ts), used from un-guard OIDC routes under `src/app/(un-guard)/oidc/`.
- **Behavior:** `extractOIDCParams` merges query and hash, repeatedly decodes `%`-encoding, strips stray `&` fragments from color values, and defaults `themeColor` to `#124091` when missing or invalid.

## Tenant / project scope (IAM)

- **Where:** Example [`idp/iam/pages/iam-management/iam-management.tsx`](../../../idp/iam/pages/iam-management/iam-management.tsx)
- **Behavior:** `tenantId` from `useProjectStore().selectedProject?.tenantId` drives `useGetOrganizationConfig` and related queries. Empty tenant → weak or empty data; ensure identifier project selection is correct before debugging IAM API failures.

## IAM tab deep-linking

- **Where:** `iam-management.tsx`
- **Behavior:** `useQueryState("tab", { defaultValue: "users" })` (nuqs) keeps the active tab in the URL.

## HTTP client: 401 and refresh

### Monolith (Next app)

- **Where:** [`src/lib/http-client.ts`](../../../src/lib/http-client.ts)
- **Behavior:** On `401`, requests queue; refresh posts to `/idp/v1/Authentication/Token` with `grant_type=refresh_token` and cookies. Failure clears auth + project stores, clears React Query, redirects to `/login`.

### UILM React (Vite SPA)

- **Where:** [`uilm-react/src/platform/api/idp-http.ts`](../../src/platform/api/idp-http.ts)
- **Behavior:** Same queue + refresh + `/login` redirect pattern; `AppProviders` registers the TanStack `QueryClient` via [`query-client-holder.ts`](../../src/platform/query/query-client-holder.ts) so refresh failure clears cached queries. Pre-session password and SSO token grants pass `skipTokenRotation: true` (see [`auth-api.ts`](../../src/features/auth/services/auth-api.ts)) so a wrong-password `401` does not trigger refresh.

## Blocked user allowlist (temporary)

- **Where:** `http-client.ts`
- **Behavior:** For blocked user IDs from `NEXT_PUBLIC_BLOCKED_USER_IDS`, non-GET calls throw unless the URL starts with an allowlisted prefix including `/idp/v1/Authentication/Logout` and `/idp/v1/Authentication/Token`.

## Signup vs IDP-only APIs

- **Where:** `auth.service.ts` — `signupByEmail` calls `PEOPLE_ENDPOINTS.SIGNUP` (identifier), not `/idp/v1/...` only.
- **Implication:** Signup bugs may involve identifier services and models under `@blocks-identifier` as well as IDP.

## Error shape for toasts

- **Pattern:** Many forms use `isErrorWithErrors` from `@/lib/error` and `showErrorToast` with `error.errors.error_description` or similar (see `signin-form.tsx`).

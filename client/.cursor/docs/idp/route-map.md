# Next.js routes → `@blocks-idp` imports

URL paths omit route groups: folders like `(main)`, `(public)`, `(internal)`, `(un-guard)`, `(auth)`, `(console)`, `(home)` do not appear in the browser path.

## Auto-generated table

_Regenerate: `npm run idp:route-map` — 2026-04-09T19:59:58.404Z_

| URL path | App route file | `@blocks-idp` import(s) |
|----------|----------------|---------------------------|
| `/activate` | `src/app/(public)/activate/page.tsx` | Activation from `@blocks-idp/authentication/pages/activation` |
| `/activate-success` | `src/app/(internal)/activate-success/page.tsx` | ActivationSuccess from `@blocks-idp/authentication/pages/activation-success` |
| `/forgot-email-sent` | `src/app/(internal)/forgot-email-sent/page.tsx` | ForgotEmailSent from `@blocks-idp/authentication/pages/forgot-email-sent` |
| `/forgot-password` | `src/app/(public)/forgot-password/page.tsx` | ForgotPassword from `@blocks-idp/authentication/pages/forgot-password` |
| `/login` | `src/app/(public)/(auth)/login/page.tsx` | Signin from `@blocks-idp/authentication/pages/login` |
| `/mfa-check` | `src/app/(internal)/mfa-check/page.tsx` | MfaCheck from `@blocks-idp/authentication/pages/mfa-check` |
| `/oidc` | `src/app/(un-guard)/oidc/page.tsx` | OIDCPermissionWrapper from `@blocks-idp/authentication/pages/oidc/permission-wrapper`; OIDCSignin from `@blocks-idp/authentication/pages/oidc/oidc-signin` |
| `/oidc/email-sent-confirmation` | `src/app/(un-guard)/oidc/email-sent-confirmation/page.tsx` | OidcEmailConfirmation from `@blocks-idp/authentication/pages/oidc/email-sent-confirmation/email-sent-confirmation` |
| `/oidc/error` | `src/app/(un-guard)/oidc/error/page.tsx` | OIDCErrorScreen from `@blocks-idp/authentication/pages/oidc/error-screen` |
| `/oidc/forgot-password` | `src/app/(un-guard)/oidc/forgot-password/page.tsx` | OidcForgotPassword from `@blocks-idp/authentication/pages/oidc/forgot-password` |
| `/oidc/login` | `src/app/(un-guard)/oidc/login/page.tsx` | OIDCSignin from `@blocks-idp/authentication/pages/oidc/oidc-signin` |
| `/oidc/permission` | `src/app/(un-guard)/oidc/permission/page.tsx` | OIDCPermissionWrapper from `@blocks-idp/authentication/pages/oidc/permission-wrapper` |
| `/profile` | `src/app/(main)/(console)/profile/page.tsx` | Profile from `@blocks-idp/iam/modules/user-management/profile` |
| `/project-overview/people/[id]` | `src/app/(main)/(console)/project-overview/people/[id]/page.tsx` | UserDevices from `@blocks-idp/iam/modules/user-management/user-devices`; useGetUserById from `@blocks-idp/iam/hooks/use-user` |
| `/reset-password-success` | `src/app/(internal)/reset-password-success/page.tsx` | ResetPasswordSuccess from `@blocks-idp/authentication/pages/reset-password-success` |
| `/resetpassword` | `src/app/(public)/resetpassword/page.tsx` | ResetPassword from `@blocks-idp/authentication/pages/reset-password` |
| `/services/authentication` | `src/app/(main)/(home)/services/authentication/page.tsx` | AuthenticationConfig from `@blocks-idp/authentication/pages/authentication-config` |
| `/services/authentication/logs` | `src/app/(main)/(home)/services/authentication/logs/page.tsx` | AuthLogs from `@blocks-idp/authentication/pages/auth-logs` |
| `/services/authentication/sso-configuration` | `src/app/(main)/(home)/services/authentication/sso-configuration/page.tsx` | SSO_PROVIDERS from `@blocks-idp/authentication/constants/sso-providers.constant`; SSOConfiguration from `@blocks-idp/authentication/pages/sso-configuration` |
| `/services/captcha` | `src/app/(main)/(home)/services/captcha/page.tsx` | ConfigureCaptcha from `@blocks-idp/captcha/pages/configure-captcha` |
| `/services/captcha/logs` | `src/app/(main)/(home)/services/captcha/logs/page.tsx` | CaptchaLog from `@blocks-idp/captcha/pages/logs` |
| `/services/iam` | `src/app/(main)/(home)/services/iam/page.tsx` | IamManagement from `@blocks-idp/iam/pages/iam-management` |
| `/services/iam/configure` | `src/app/(main)/(home)/services/iam/configure/page.tsx` | Configure from `@blocks-idp/iam/modules/user-management` |
| `/services/iam/logs` | `src/app/(main)/(home)/services/iam/logs/page.tsx` | IamLogs from `@blocks-idp/iam/modules/user-management` |
| `/services/iam/organization-detail/[itemId]` | `src/app/(main)/(home)/services/iam/organization-detail/[itemId]/page.tsx` | OrganizationDetail from `@blocks-idp/iam/pages/organization-detail/organization-detail` |
| `/services/iam/permission-detail/[id]` | `src/app/(main)/(home)/services/iam/permission-detail/[id]/page.tsx` | PermissionDetails from `@blocks-idp/iam/modules/permission-management/permission-details` |
| `/services/iam/permission-detail/new` | `src/app/(main)/(home)/services/iam/permission-detail/new/page.tsx` | AddPermission from `@blocks-idp/iam/modules/permission-management` |
| `/services/iam/role-detail/[id]` | `src/app/(main)/(home)/services/iam/role-detail/[id]/page.tsx` | RoleDetails from `@blocks-idp/iam/modules/role-management` |
| `/services/iam/user-detail/[id]` | `src/app/(main)/(home)/services/iam/user-detail/[id]/page.tsx` | User from `@blocks-idp/iam/modules/user-management` |
| `/services/mfa` | `src/app/(main)/(home)/services/mfa/page.tsx` | ConfigureMFA from `@blocks-idp/mfa/pages/configure-mfa/configure-mfa` |
| `/services/mfa/logs` | `src/app/(main)/(home)/services/mfa/logs/page.tsx` | MfaLogs from `@blocks-idp/mfa/pages/logs` |
| `/signup` | `src/app/(public)/(auth)/signup/page.tsx` | Signup from `@blocks-idp/authentication/pages/signup` |
| `/signup-email-sent` | `src/app/(internal)/signup-email-sent/page.tsx` | SignupEmailSent from `@blocks-idp/authentication/pages/signup-email-sent` |
| `/sso-activate` | `src/app/(public)/(auth)/sso-activate/page.tsx` | SsoActivate from `@blocks-idp/authentication/pages/sso-activate` |

## Notes

- **Hooks in `page.tsx`:** Some pages import hooks and components; this table lists every `import … from \`@blocks-idp/…\`` line in that file.
- **Constants:** Imports such as `SSO_PROVIDERS` appear alongside React components.
- **Other `@blocks-idp` usage:** This table only covers `src/app/**/page.tsx`. For identifier, data-gateway, etc., run: `rg '@blocks-idp' --glob '!src/app/**/page.tsx'`.

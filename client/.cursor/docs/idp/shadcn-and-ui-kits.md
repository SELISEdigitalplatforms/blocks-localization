# Shadcn UI and `ui-kits` (IDP)

## Project configuration

- Root [`components.json`](../../../components.json) is the shadcn schema: `aliases.components` → `@/components`, `aliases.utils` → `@/lib/utils`, Tailwind + Radix stack.

## Where IDP imports UI

IDP **does not** ship its own copy of Button, Form, Dialog, etc. It imports from the app:

- **Primary:** `@/components/ui-kits/<name>/<name>.tsx` — e.g. `button/button`, `form/form`, `tabs/tabs`, `select/select`, `input/input`.
- **Shared app widgets:** `@/components/password-input`, `@/components/captcha`, `@/components/action-buttons/...`, etc.

## Example

[`idp/authentication/pages/login/signin-form.tsx`](../../../idp/authentication/pages/login/signin-form.tsx):

- `Form`, `FormField`, … from `@/components/ui-kits/form/form`
- `Input` from `@/components/ui-kits/input/input`
- `Button` from `@/components/ui-kits/button/button`
- `PasswordInput`, `Captcha` from `@/components/...`

## Rules of thumb

1. **New IDP screens:** Reuse `ui-kits` patterns already used in neighboring IDP files; do not add parallel primitive folders under `idp/`.
2. **Adding a new primitive:** Add via shadcn CLI into `src/components` (per `components.json`), then wrap or re-export in `ui-kits` if that is the project convention for that component.
3. **Radix direct imports:** Some pages import from `@radix-ui/react-tabs` alongside `ui-kits` (e.g. `TabsContent`); follow existing file patterns when splitting primitives vs composition.

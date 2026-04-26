# Refactor-clean (uilm-react)

Dead-code and dependency hygiene for this Vite SPA, aligned with the Cursor `/refactor-clean` command and **`code-architect`** review for non-SAFE work.

## Canonical spec

From the monorepo root:

[`docs/superpowers/specs/2026-04-11-uilm-react-refactor-clean-architecture-design.md`](../../../../docs/superpowers/specs/2026-04-11-uilm-react-refactor-clean-architecture-design.md)

## Commands

```bash
cd uilm-react
npm run dead-code:knip
npm run dead-code:depcheck
```

`dead-code:depcheck` runs `scripts/run-depcheck.cjs`, which merges depcheck’s default parsers with a **Tailwind CSS v4** CSS parser (`scripts/depcheck-tailwind-v4-css-parser.cjs`). It reads `@import "…"` and `@plugin "…"` in `*.css` (e.g. `src/styles/globals.css`) so packages such as `tailwindcss`, `tailwindcss-animate`, and `@tailwindcss/typography` count as **used** without listing them as blanket ignores.

Verification after any code removal:

```bash
npm run test && npm run lint && npm run build
```

## Notes

- Knip may list `src/platform/ui/**` or Radix-related deps as unused when consumption is indirect (barrels, composition). Classify as **CAUTION** and involve **code-architect** before removal.
- `.depcheckrc.json` `ignores` only covers tooling depcheck cannot infer (Vite plugin, Vitest, knip, types, etc.) — not Tailwind plugins referenced from CSS.

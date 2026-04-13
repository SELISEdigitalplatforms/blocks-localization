---
name: uilm-react-spa-metadata
description: Use when changing page titles, meta description, favicon, or head tags in the uilm-react Vite SPA (parity with Next.js metadata).
---

# UILM React — SPA metadata

## Overview

Head management uses **`react-helmet-async`** (React 18). Global defaults live in `RootMeta`; each route adds `PageMeta`. Favicon URLs must go through **`publicAsset()`** so Vite `base` works.

## When to use

- New route / screen: add `<PageMeta title="Section" />` (optional `description`).
- Change site-wide title template, author, or default description: edit `src/seo/root-meta.tsx` and `src/seo/site-defaults.ts`.
- New static icon: put file in `public/`, run `npm run sync:assets` if copied from monolith, reference via `publicAsset('…')`.

## When not to use

- Do not add a second `HelmetProvider`.
- Do not expect full SEO parity with Next `metadata` without preredering (see plan disclaimer).

## Quick reference

| Need | Action |
|------|--------|
| Page title `X \| Blocks Cloud` | `<PageMeta title="X" />` |
| Override description | `<PageMeta title="X" description="…" />` |
| Global defaults | `RootMeta` in `App.tsx` |

## Common mistakes

- Hard-coding `/Favicon-new.svg` in React components — use `publicAsset`.
- Installing `@unhead/react@3` on React 18 — peer dependency requires React 19+; use `react-helmet-async` until UILM upgrades React.

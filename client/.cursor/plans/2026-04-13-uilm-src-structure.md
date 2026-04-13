# UILM `src/` structure alignment — implementation plan

## Brainstorming / design (summary)

- **Problem:** Next.js-only `"use client"` is meaningless in Vite + React 18 and adds noise; app chrome lived in a top-level `shell/` while route wrappers already lived in `layouts/`, which splits “layout” across two roots.
- **Approach (recommended):** Align with common React 2025-style structure ([DEV guide](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc)): **features** (auth, console, profile, uilm), **pages**, **layouts** (route shells + shared chrome), **platform** for design-system/synced UI. Move `shell` under `layouts/shell` and normalize imports; strip all `"use client"` lines (with or without semicolons).
- **Non-goals:** No token/CSS changes; no feature logic refactors; no commit.

> **For agentic workers:** Use subagent-driven-development or executing-plans for task-by-task execution.

**Goal:** Remove Next.js-only `"use client"` from Vite/React TS sources, and colocate app chrome (headers, sidebars, shell hooks) under `src/layouts/` per [recommended React 2025 folder layout](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc) (layouts vs features vs shared UI).

**Architecture:** Keep `features/{auth,console,profile,uilm}`, `pages/`, `platform/` (shared primitives + sync’d UI kits), `routing/`. Move `src/shell/` → `src/layouts/shell/` so route layouts in `layouts/*.tsx` and chrome in `layouts/shell/**` share one top-level concern. Replace imports `@/shell/…` → `@/layouts/shell/…` and update `platform-ui-monolith-transform.mjs` so future `npm run sync:ui` emits the new paths.

**Tech stack:** Vite 6, React 18, TypeScript, path alias `@/*` → `src/*`.

**Constraints:** No git commit; `npm run lint` and `npm run build` must pass; no visual/design token changes.

---

## Tasks executed (checklist)

- [x] **T1:** Add this plan under `uilm-react/.cursor/plans/`.
- [x] **T2:** Strip lines matching `"use client";` / `'use client';` from all `src/**/*.ts(x)`.
- [x] **T3:** `mv src/shell src/layouts/shell`.
- [x] **T4:** Global replace `@/shell/` → `@/layouts/shell/` in `uilm-react/src` and `uilm-react/scripts/platform-ui-monolith-transform.mjs`.
- [x] **T5:** Run `npm run lint` and `npm run build` in `uilm-react`.
- [x] **T6:** Append `change.md` (repo root) unreleased bullet.

---

## Post-change map| Area | Path |
|------|------|
| Route shells | `src/layouts/*.tsx`, `src/layouts/index.ts` |
| App chrome (header, sidebar, nav config) | `src/layouts/shell/**` |
| Feature modules | `src/features/*` |
| Pages (route targets) | `src/features/*/pages/*`, `src/routing/stub-page.tsx` |
| Design-system / synced UI | `src/platform/ui/**` |

---

## Self-review

- No duplicate `@/shell` left: grep `uilm-react` for `@/shell/`.
- Sync script still rewrites monolith hooks to UILM layout paths.

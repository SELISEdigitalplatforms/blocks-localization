# Project overview parity (UILM React)

`/project-overview/*` lives **inside** [`console-shell-layout.tsx`](../../../src/layouts/console-shell-layout.tsx) so the **same console header** (logo, project switcher, Back to console, utilities) applies. The **left rail** matches the monolith **project overview sidebar** and `DesktopMenuItem` behavior.

## Monolith sources of truth

| UILM | Next / identifier |
|------|-------------------|
| [`project-overview-shell-layout.tsx`](../../../src/layouts/project-overview-shell-layout.tsx) | [`src/app/(main)/(console)/project-overview/layout.tsx`](../../../../../src/app/(main)/(console)/project-overview/layout.tsx) |
| Sidebar structure + active rail | [`project-overview-sidebar-desktop.tsx`](../../../../../src/layouts/project-overview-sidebar/project-overview-sidebar-desktop.tsx), [`desktop-menu-item.tsx`](../../../../../src/components/menus/desktop-menu-item.tsx) |
| Mobile sheet | [`project-overview-sidebar-mobile.tsx`](../../../../../src/layouts/project-overview-sidebar/project-overview-sidebar-mobile.tsx) |
| Environments page body | [`identifier/pages/environments/environments.tsx`](../../../../../identifier/pages/environments/environments.tsx) |
| Environment card | [`environment-card.tsx`](../../../../../identifier/components/project-group-overview/environment-card/environment-card.tsx) |

## Design tokens

- **Header** (console, when chrome visible): `bg-background` — same as Next `console-header.tsx` (white bar).
- **Sidebar rail**: `bg-sidebar-nav` (`--sidebar-nav`, ~`#F9FAFB` light) + `border-r`; nav items `text-low-emphasis` → hover `text-high-emphasis`, active `text-primary` + **right-edge** `h-5 w-1 rounded-lg bg-primary`.
- **Main pane** (scroll): `bg-canvas-muted` (`--canvas-muted`, ~`#F3F4F6` light). Next layout uses `bg-surface-app` for children; UILM uses a slightly flatter gray for screenshot parity.
- **Chatbot:** Same spirit as monolith [`chatbot-embedder.tsx`](../../../../../src/providers/chatbot-embedder.tsx). [`BlocksChatbotEmbed`](../../../src/layouts/shell/blocks-chatbot-embed.tsx) loads the vendor script at `${WIDGET_URL}/embed.js` when **both** `NEXT_PUBLIC_WIDGET_URL` and `NEXT_PUBLIC_WIDGET_ID` are set (or `VITE_*` equivalents). See embed module comments for fallback behavior when URL or id is missing.

## Workflow: brainstorming → plan → execute

Use Superpowers skills in order for larger UI passes:

1. **Brainstorming** — clarify scope, options, written design; spec path convention: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
2. **Writing plans** — bite-sized tasks: `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
3. **Executing plans** — implement in `uilm-react` (or dispatch subagents); **no commit** if the session requires a dirty tree only.

Related index: [`blocks-shell-parity.md`](./blocks-shell-parity.md).

## Scripts

```bash
cd uilm-react && npm run lint    # tsc --noEmit
cd uilm-react && npm run dev     # Vite on port 4000 (see package.json)
```

/**
 * AI-agent prompt copied from Extension Guides → Key/Value Mode Integration.
 *
 * Held as a plain string (not a `.md?raw` import) because the repo gitignores
 * `*.md` outside a short allowlist, so a markdown sibling cannot be committed
 * or resolved in CI.
 */
export const KEY_MODE_INSTRUCTIONS_MD = `# SELISE Blocks Assistant — Key Mode / Value Mode integration

Configure this app so the SELISE Blocks Assistant browser extension can toggle between **Value Mode** (show translated strings) and **Key Mode** (show localization keys) at runtime.

## Event contract

The extension posts a same-window message:

\`\`\`ts
{
  action: "keymode"
  keymode: boolean // true = Key Mode, false = Value Mode
  defaultLang?: string // optional; ignore if unused
}
\`\`\`

Listen with \`window.addEventListener("message", …)\` and only accept messages where:

- \`event.source === window\`
- \`event.origin === window.location.origin\`
- \`data\` is an object with \`action === "keymode"\` and a boolean \`keymode\`

## Required behaviour

1. Keep a runtime flag (for example \`window.__i18nKeyMode\`).
2. When \`keymode\` is \`true\`, translation lookups must return the **key** (not the translated value).
3. When \`keymode\` is \`false\`, restore normal translation lookups.
4. After the flag changes, force UI re-render for every bound string (framework-specific below).

## React + i18next (reference)

\`\`\`ts
declare global {
  interface Window {
    __i18nKeyMode?: boolean
  }
}

if (typeof window !== "undefined") {
  window.__i18nKeyMode = false
}

const originalT = i18n.t.bind(i18n)

;(i18n as any).t = (key: string | string[], options?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && window.__i18nKeyMode) {
    return Array.isArray(key) ? key[0] : key
  }
  return (originalT as any)(key, options)
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (event.origin !== window.location.origin) return
    const data = event.data
    if (!data || typeof data !== "object") return

    const { action, keymode } = data as { action?: string; keymode?: boolean }
    if (action !== "keymode" || typeof keymode !== "boolean") return

    const previous = window.__i18nKeyMode
    window.__i18nKeyMode = keymode
    if (previous !== keymode) {
      ;(i18n as any).emit("languageChanged", i18n.language)
    }
  })
}
\`\`\`

## Other frameworks

- **Vue / vue-i18n**: wrap \`t\` (or your composer) the same way; after toggling, trigger a reactive update (\`locale\` bump or \`forceUpdate\` on bound roots).
- **Angular / ngx-translate**: intercept the translate pipe/service; markForCheck / re-emit locale when the flag flips.
- **Custom dictionaries**: gate every lookup on the shared flag and re-render the tree when it changes.

## Done when

- Extension Key Mode shows raw keys in the UI.
- Value Mode shows translations again without a full page reload.
- Cross-origin / iframe \`message\` events are ignored.
`

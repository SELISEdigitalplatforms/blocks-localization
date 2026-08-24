/**
 * Localization E2E feature list — edit `enabled` and order here.
 * Run: npm run test:features
 *
 * Env: E2E_FEATURES=overview,translations  or  E2E_FEATURES=all
 */

/** @type {{ id: string, name: string, enabled: boolean, spec: string }[]} */
export const FLOW_FEATURES = [
  {
    id: "overview",
    name: "Overview — full flow",
    enabled: true,
    spec: "tests/flows/overview/overview-flow.spec.ts",
  },
  {
    id: "translations",
    name: "Translations page",
    enabled: true,
    spec: "tests/flows/translations/translations.spec.ts",
  },
  {
    id: "modules",
    name: "Module page",
    enabled: true,
    spec: "tests/flows/modules/module.spec.ts",
  },
  {
    id: "glossary",
    name: "Glossary page",
    enabled: true,
    spec: "tests/flows/glossary/glossary.spec.ts",
  },
  {
    id: "configuration",
    name: "Configuration page",
    enabled: true,
    spec: "tests/flows/configuration/configuration.spec.ts",
  },
  {
    id: "extension-guides",
    name: "Extension Guides page",
    enabled: true,
    spec: "tests/flows/extension-guides/extension-guides.spec.ts",
  },
]

export function resolveEnabledFeatures() {
  const override = process.env.E2E_FEATURES?.trim()

  if (!override || override === "all") {
    return FLOW_FEATURES.filter((feature) => feature.enabled)
  }

  const ids = override.split(",").map((id) => id.trim()).filter(Boolean)
  /** @type {typeof FLOW_FEATURES} */
  const selected = []

  for (const id of ids) {
    const feature = FLOW_FEATURES.find((entry) => entry.id === id)
    if (!feature) {
      throw new Error(
        `Unknown E2E feature "${id}". Valid ids: ${FLOW_FEATURES.map((f) => f.id).join(", ")}`,
      )
    }
    selected.push(feature)
  }

  return selected
}

/**
 * TypeScript mirror of features.mjs — keep both files in sync when adding features.
 * The runner reads features.mjs; this file is for IDE autocomplete in specs if needed.
 */
export type FlowFeature = {
  id: string
  name: string
  enabled: boolean
  spec: string
}

export const FLOW_FEATURES: FlowFeature[] = [
  {
    id: "overview",
    name: "Overview — full flow",
    enabled: true,
    spec: "tests/01-overview/overview.spec.ts",
  },
  {
    id: "translations",
    name: "Translations page",
    enabled: true,
    spec: "tests/02-translations/translations.spec.ts",
  },
  {
    id: "modules",
    name: "Module page",
    enabled: true,
    spec: "tests/03-modules/modules.spec.ts",
  },
  {
    id: "glossary",
    name: "Glossary page",
    enabled: true,
    spec: "tests/04-glossary/glossary.spec.ts",
  },
  {
    id: "configuration",
    name: "Configuration page",
    enabled: true,
    spec: "tests/05-configuration/configuration.spec.ts",
  },
  {
    id: "extension-guides",
    name: "Extension Guides page",
    enabled: true,
    spec: "tests/06-extension-guides/extension-guides.spec.ts",
  },
]

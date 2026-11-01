import { registerTranslations } from "@seliseblocks/genesis-os/i18n";

// Bundled English for every module. German comes from the remote dictionary.
export const bundledModules: Record<string, Record<string, string>> = {};

for (const [module, dictionary] of Object.entries(bundledModules)) {
  registerTranslations(module, dictionary);
}

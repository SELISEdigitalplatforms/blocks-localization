import { registerTranslations } from "@seliseblocks/genesis-os/i18n";
import shared from "./localization.shared.en.json";

// Bundled English for every module. German comes from the remote dictionary.
export const bundledModules: Record<string, Record<string, string>> = {
  "localization.shared": shared,
};

for (const [module, dictionary] of Object.entries(bundledModules)) {
  registerTranslations(module, dictionary);
}

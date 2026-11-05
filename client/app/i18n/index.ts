// i18n modules. English is bundled from the files below; every other language the project enables
// comes from the localization service at runtime.
//
//   localization.glossary        components/glossary, components/modals/{glossary,tag-glossary-modal,
//                                edit-key-glossary}, glossary hooks/utils                         237 keys
//   localization.keys            language-module/{add-new-language-key,key-details}, components/view-details,
//                                modals/{edit-translation,delete-language-key,auto-translate,gpt-prompt} 114
//   localization.language-table  language-module/language-table, components/language-table-toolbar   152
//   localization.modules         language-module/modules, modals/{new-module,edit-module,
//                                delete-module-modal,new-language,edit-route}                          97
//   localization.shared          components, layout, hooks, lib, constants, router                      76
//   localization.tools           language-module/{configure,export-history,extension-guides,
//                                wordpress-plugin-guide,timeline,localization-timeline,activity-log},
//                                components/import-language-file, modals/export-key                   178
//                                                                                          total      854
import { registerTranslations } from "@seliseblocks/genesis-os/i18n";
import glossary from "./localization.glossary.en.json";
import keys from "./localization.keys.en.json";
import languageTable from "./localization.language-table.en.json";
import modules from "./localization.modules.en.json";
import shared from "./localization.shared.en.json";
import tools from "./localization.tools.en.json";

// Bundled English for every module. Other languages come from the localization service.
export const bundledModules: Record<string, Record<string, string>> = {
  "localization.glossary": glossary,
  "localization.keys": keys,
  "localization.language-table": languageTable,
  "localization.modules": modules,
  "localization.shared": shared,
  "localization.tools": tools,
};

for (const [module, dictionary] of Object.entries(bundledModules)) {
  registerTranslations(module, dictionary);
}

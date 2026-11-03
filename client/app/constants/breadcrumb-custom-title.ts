import { tStatic } from "@seliseblocks/genesis-os/i18n";

type BreadcrumbRouteConfig = {
  /** Translation key (module localization.shared) of the fixed title. */
  titleKey?: string;
  skip?: boolean;
  dynamic?: boolean;
};

export const BREADCRUMB_ROUTES: Record<string, BreadcrumbRouteConfig> = {
  "/app": {
    skip: true,
  },
  "/app/:itemId": {
    skip: true,
  },
  "/app/:itemId/services": {
    skip: true,
  },
  "/app/:itemId/services/authentication": {
    titleKey: "BREADCRUMB.IAM",
  },
  "/app/:itemId/services/language": {
    titleKey: "BREADCRUMB.LANGUAGE_TRANSLATION_KEYS",
  },
  "/app/:itemId/services/configure": {
    titleKey: "BREADCRUMB.CONFIGURE",
  },
  "/app/:itemId/services/language/export-history": {
    titleKey: "BREADCRUMB.EXPORT_HISTORY",
  },
  "/app/:itemId/services/modules": {
    titleKey: "BREADCRUMB.LANGUAGE_MODULE",
  },
  "/app/:itemId/services/modules/:moduleId": {
    titleKey: "BREADCRUMB.MODULE",
    dynamic: true,
  },
  "/app/:itemId/services/language/translations": {
    skip: true,
  },
  "/app/:itemId/services/language/translations/new-key": {
    titleKey: "BREADCRUMB.NEW_KEY",
  },
  "/app/:itemId/services/language/translations/:keyId": {
    titleKey: "BREADCRUMB.KEY",
    dynamic: true,
  },
  "/app/:itemId/services/glossary": {
    titleKey: "BREADCRUMB.GLOSSARIES",
  },
  "/app/:itemId/services/glossary/:glossaryId": {
    titleKey: "BREADCRUMB.GLOSSARY",
    dynamic: true,
  },
};

const BREADCRUMB_CUSTOM_TITLES: Record<string, string | null> = {};
const BREADCRUMB_SKIP_PATHS: string[] = [];

// Fixed titles are read through a getter so they follow the language at the moment they are
// shown. Assigning a title later (a loaded key or module name) replaces the getter with that text.
const defineTranslatedTitle = (path: string, key: string) => {
  Object.defineProperty(BREADCRUMB_CUSTOM_TITLES, path, {
    enumerable: true,
    configurable: true,
    get: () => tStatic("localization.shared", key),
    set: (value: string | null) =>
      Object.defineProperty(BREADCRUMB_CUSTOM_TITLES, path, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      }),
  });
};

for (const [path, config] of Object.entries(BREADCRUMB_ROUTES)) {
  if (config.titleKey !== undefined) {
    defineTranslatedTitle(path, config.titleKey);
  } else if (config.dynamic) {
    BREADCRUMB_CUSTOM_TITLES[path] = null;
  }
  if (config.skip) {
    BREADCRUMB_SKIP_PATHS.push(path);
  }
}

export { BREADCRUMB_CUSTOM_TITLES, BREADCRUMB_SKIP_PATHS };

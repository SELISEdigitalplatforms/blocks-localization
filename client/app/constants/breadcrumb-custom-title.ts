type BreadcrumbRouteConfig = {
  title?: string;
  skip?: boolean;
  dynamic?: boolean;
};

export const BREADCRUMB_ROUTES: Record<string, BreadcrumbRouteConfig> = {
  "/services/authentication": {
    title: "IDP",
  },
  "/services/language": {
    title: "Language Translation Keys",
  },
  "/services/configure": {
    title: "Configure",
  },
  "/services/language/export-history": {
    title: "Export history",
  },
  "/services/modules": {
    title: "Language module",
  },
  "/services/language/translations": {
    skip: true,
  },
  "/services/language/translations/new-key": {
    title: "New Key",
  },
  "/services/language/translations/:keyId": {
    title: "Key",
    dynamic: true,
  },
  "/services/glossary": {
    title: "Glossaries",
  },
  "/services/glossary/:itemId": {
    title: "Glossary",
    dynamic: true,
  },
};

const BREADCRUMB_CUSTOM_TITLES: Record<string, string | null> = {};
const BREADCRUMB_SKIP_PATHS: string[] = [];

for (const [path, config] of Object.entries(BREADCRUMB_ROUTES)) {
  if (config.title !== undefined) {
    BREADCRUMB_CUSTOM_TITLES[path] = config.title;
  } else if (config.dynamic) {
    BREADCRUMB_CUSTOM_TITLES[path] = null;
  }
  if (config.skip) {
    BREADCRUMB_SKIP_PATHS.push(path);
  }
}

export { BREADCRUMB_CUSTOM_TITLES, BREADCRUMB_SKIP_PATHS };

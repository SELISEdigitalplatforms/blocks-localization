type BreadcrumbRouteConfig = {
  title?: string;
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
    title: "IAM",
  },
  "/app/:itemId/services/language": {
    title: "Language Translation Keys",
  },
  "/app/:itemId/services/configure": {
    title: "Configure",
  },
  "/app/:itemId/services/language/export-history": {
    title: "Export history",
  },
  "/app/:itemId/services/modules": {
    title: "Language module",
  },
  "/app/:itemId/services/modules/:moduleId": {
    title: "Module",
    dynamic: true,
  },
  "/app/:itemId/services/language/translations": {
    skip: true,
  },
  "/app/:itemId/services/language/translations/new-key": {
    title: "New Key",
  },
  "/app/:itemId/services/language/translations/:keyId": {
    title: "Key",
    dynamic: true,
  },
  "/app/:itemId/services/glossary": {
    title: "Glossaries",
  },
  "/app/:itemId/services/glossary/:glossaryId": {
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

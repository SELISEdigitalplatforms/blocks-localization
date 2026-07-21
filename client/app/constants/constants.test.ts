import { describe, expect, it } from "vitest";

import { API_BASES } from "@/constants/endpoint.constant";
import {
  BREADCRUMB_CUSTOM_TITLES,
  BREADCRUMB_ROUTES,
  BREADCRUMB_SKIP_PATHS,
} from "@/constants/breadcrumb-custom-title";
import { environmentOptions } from "@/constants/environment-options";
import { ModuleName } from "@/constants/modules.constants";
import { navigationMenus } from "@/constants/navigation-menus";
import {
  MIGRATION_ENDPOINTS,
  PROJECT_ENDPOINTS,
} from "@/constants/projects";

describe("constants/endpoint.constant", () => {
  it("should expose /api-scoped bases", () => {
    expect(API_BASES.UILM).toBe("/api");
    expect(API_BASES.IDENTIFIER).toBe("/api");
  });
  it("should append /api to runtime-derived bases", () => {
    expect(API_BASES.LOGIC).toContain("/api");
    expect(API_BASES.IAM).toContain("/api");
    expect(API_BASES.IDP).toContain("/api");
  });
});

describe("constants/breadcrumb-custom-title", () => {
  it("should register custom titles for routes with a title", () => {
    expect(BREADCRUMB_CUSTOM_TITLES["/app/:itemId/services/language"]).toBe(
      "Language Translation Keys",
    );
    expect(BREADCRUMB_CUSTOM_TITLES["/app/:itemId/services/configure"]).toBe(
      "Configure",
    );
  });

  it("should keep the explicit title for a dynamic route that also has one", () => {
    // This route is both `dynamic` and has a `title`; title wins in the loop.
    expect(
      BREADCRUMB_CUSTOM_TITLES["/app/:itemId/services/modules/:moduleId"],
    ).toBe("Module");
  });

  it("should collect skip paths", () => {
    expect(BREADCRUMB_SKIP_PATHS).toContain("/app");
    expect(BREADCRUMB_SKIP_PATHS).toContain("/app/:itemId/services");
  });

  it("should keep BREADCRUMB_ROUTES and derived maps consistent", () => {
    for (const [path, cfg] of Object.entries(BREADCRUMB_ROUTES)) {
      if (cfg.skip) expect(BREADCRUMB_SKIP_PATHS).toContain(path);
      if (cfg.title) expect(BREADCRUMB_CUSTOM_TITLES[path]).toBe(cfg.title);
    }
  });
});

describe("constants/environment-options", () => {
  it("should expose 8 ordered environment options", () => {
    expect(environmentOptions).toHaveLength(8);
    expect(environmentOptions.map((e) => e.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });
  it("should end with Production", () => {
    expect(environmentOptions[7]).toMatchObject({
      value: "prod",
      label: "Production",
    });
  });
});

describe("constants/modules.constants", () => {
  it("should map module names to their numeric ids", () => {
    expect(ModuleName.Cloud).toBe(1);
    expect(ModuleName.Localization).toBe(6);
    expect(ModuleName.DataGateway).toBe(11);
  });
});

describe("constants/navigation-menus", () => {
  it("should include a Translations menu entry", () => {
    const translations = navigationMenus.find(
      (m) => m.type === "menu" && m.name === "Translations",
    );
    expect(translations).toBeDefined();
  });

  it("should include exactly one separator", () => {
    expect(navigationMenus.filter((m) => m.type === "separator")).toHaveLength(
      1,
    );
  });

  it("should give every menu entry a path", () => {
    for (const m of navigationMenus) {
      if (m.type === "menu") {
        expect(m.path).toMatch(/^\/app\//);
      }
    }
  });
});

describe("constants/projects", () => {
  it("should build project endpoints from the logic base", () => {
    expect(PROJECT_ENDPOINTS.GETS).toContain("/Project/Gets");
    expect(PROJECT_ENDPOINTS.DISABLE).toContain("/Project/Disable");
  });
  it("should expose migration endpoints", () => {
    expect(MIGRATION_ENDPOINTS.MIGRATE).toContain("/Migration/Migrate");
    expect(MIGRATION_ENDPOINTS.VERIFY).toContain("/Migration/Verify");
  });
});

import type { LucideIcon } from "lucide-react";
import { Globe } from "lucide-react";

/**
 * Dashboard shell sidebar entries for UILM React (minimal set).
 * Extend this list when additional console areas are ported.
 */
export type DashboardNavSeparator = { type: "separator"; id: string };

export type DashboardNavMenu = {
  type: "menu";
  id: string;
  name: string;
  /** Path with leading `/` — normalized to router segments in `getDashboardStubRoutes`. */
  path: string;
  icon?: LucideIcon;
  badge?: string;
  disabled?: boolean;
  children?: DashboardNavMenu[];
};

export type DashboardNavEntry = DashboardNavSeparator | DashboardNavMenu;

export const dashboardNavigationMenus: DashboardNavEntry[] = [
  // {
  //   type: "menu",
  //   id: "overview-project",
  //   name: "Overview",
  //   path: "/dashboard",
  //   icon: Home,
  // },
  // { type: "separator", id: "separator-1" },
  {
    type: "menu",
    id: "service-language",
    name: "Localization",
    path: "/services/language",
    icon: Globe,
  },
];

function pathToRoutePath(abs: string): string {
  return abs.replace(/^\//, "");
}

/** Paths backed by real pages (no `StubPage` route). */
function isImplementedDashboardPath(abs: string): boolean {
  // if (abs === "/dashboard") return true;
  if (abs === "/services/language" || abs.startsWith("/services/language/")) return true;
  return false;
}

export type DashboardStubRoute = { path: string; title: string };

/**
 * Stub routes derived from the nav tree (currently none — only implemented entries above).
 */
export function getDashboardStubRoutes(): DashboardStubRoute[] {
  const seen = new Set<string>();
  const out: DashboardStubRoute[] = [];

  function walk(entries: DashboardNavEntry[]) {
    for (const e of entries) {
      if (e.type === "separator") continue;
      if (e.disabled) continue;
      const abs = e.path;
      if (!isImplementedDashboardPath(abs)) {
        const p = pathToRoutePath(abs);
        if (!seen.has(p)) {
          seen.add(p);
          out.push({ path: p, title: e.name });
        }
      }
      if (e.children?.length) walk(e.children);
    }
  }

  walk(dashboardNavigationMenus);
  return out;
}

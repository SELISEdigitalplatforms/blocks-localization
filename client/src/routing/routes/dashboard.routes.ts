import { LanguageSection } from "@/features/uilm/language-section";
import { DashboardShellLayout } from "@/layouts/dashboard-shell-layout";
import { StubPage } from "@/routing/stub-page";
import { getDashboardStubRoutes } from "@/layouts/shell/navigation/dashboard-navigation-menus";
import { createElement } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { languageRouteChildren } from "./language.routes";

const dashboardStubChildren: RouteObject[] = getDashboardStubRoutes().map(({ path, title }) => ({
  path,
  element: createElement(StubPage, { title }),
}));

export const dashboardRoutes: RouteObject[] = [
  {
    Component: DashboardShellLayout,
    children: [
      { path: "dashboard", element: createElement(Navigate, { to: "/services/language", replace: true }) },
      {
        path: "services/language",
        Component: LanguageSection,
        children: languageRouteChildren,
      },
      ...dashboardStubChildren,
    ],
  },
];

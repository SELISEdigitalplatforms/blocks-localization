import type { RouteObject } from "react-router-dom";
import { consoleRoutes } from "./console.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { publicRoutes } from "./public.routes";
import { rootFallbackRoutes } from "./root-fallback.routes";

export function getAppRouteTree(): RouteObject[] {
  return [...publicRoutes, ...consoleRoutes, ...dashboardRoutes, ...rootFallbackRoutes];
}

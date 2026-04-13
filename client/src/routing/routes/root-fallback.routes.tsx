import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";

export function RootLoginRedirect() {
  return <Navigate to="/login" replace />;
}

export const rootFallbackRoutes: RouteObject[] = [
  { path: "/", Component: RootLoginRedirect },
  { path: "*", Component: RootLoginRedirect },
];

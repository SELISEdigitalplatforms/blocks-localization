import { ConfigurePage } from "@/features/uilm/pages/configure-page";
import { ExportHistoryPage } from "@/features/uilm/pages/export-history-page";
import { KeyDetailPage } from "@/features/uilm/pages/key-detail-page";
import { LanguageWorkspacePage } from "@/features/uilm/pages/language-workspace-page";
import { NewKeyPage } from "@/features/uilm/pages/new-key-page";
import type { RouteObject } from "react-router-dom";

/** Child routes mounted at `/services/language` under `DashboardShellLayout` (`LanguageSection`). */
export const languageRouteChildren: RouteObject[] = [
  { index: true, Component: LanguageWorkspacePage },
  { path: "configure", Component: ConfigurePage },
  { path: "export-history", Component: ExportHistoryPage },
  { path: "translations/new-key", Component: NewKeyPage },
  { path: "translations/:id", Component: KeyDetailPage },
];

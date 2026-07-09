import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import {
  CallbackPage,
  ConsolePage,
  DashboardOverview,
  EnvironmentsPage,
  LoginPage,
  ProfilePage,
} from "@seliseblocks/blocks-kit/pages";
import {
  ProjectOverviewRoute,
  DashboardRoute,
  ConsoleLayout,
} from "@seliseblocks/blocks-kit/layouts";
import {
  ProtectedGuard,
  PublicGuard,
  AuthResolver,
} from "@seliseblocks/blocks-kit/guards";
import {
  LocalizationConfigurePage,
  LocalizationExportHistoryPage,
  LocalizationGlossaryDetailPage,
  LocalizationGlossaryPage,
  LocalizationKeyDetailPage,
  LocalizationLanguageHomePage,
  LocalizationLogsPage,
  LocalizationModuleDetailPage,
  LocalizationModulesPage,
  LocalizationNewKeyPage,
} from "./layout/localization-page-layout/localization-page-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { navigationMenus } from "./constants/navigation-menus";

const redirectPaths: Record<string, string> = {
  "/app/:itemId/services/language/translations/*":
    "/app/:itemId/services/language",
};

export const router = createBrowserRouter([
  {
    element: (
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    ),
    children: [
      {
        path: "/login/callback",
        element: <CallbackPage defaultRedirectUrl="/app/console" />,
      },
      {
        element: (
          <AuthResolver>
            <Outlet />
          </AuthResolver>
        ),
        children: [
          {
            element: (
              <PublicGuard>
                <Outlet />
              </PublicGuard>
            ),
            children: [{ path: "/login", element: <LoginPage /> }],
          },
          {
            path: "/app",
            element: (
              <ProtectedGuard>
                <Outlet />
              </ProtectedGuard>
            ),
            children: [
              {
                index: true,
                element: <Navigate to="console" replace />,
              },
              {
                element: (
                  <ConsoleLayout>
                    <Outlet />
                  </ConsoleLayout>
                ),
                children: [
                  { path: "profile", element: <ProfilePage /> },
                  { path: "console", element: <ConsolePage /> },
                ],
              },
              {
                path: "project/:tenantGroupId",
                element: (
                  <ProjectOverviewRoute
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}
                  />
                ),
                children: [
                  {
                    index: true,
                    element: <Navigate to="environments" replace />,
                  },
                  {
                    path: "environments",
                    element: <EnvironmentsPage />,
                  },
                ],
              },
              {
                path: ":itemId",
                element: (
                  <DashboardRoute
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}
                  />
                ),
                children: [
                  { index: true, element: <Navigate to="dashboard" replace /> },
                  { path: "dashboard", element: <DashboardOverview /> },
                  {
                    path: "services/language",
                    element: <LocalizationLanguageHomePage />,
                  },
                  {
                    path: "services/configure",
                    element: <LocalizationConfigurePage />,
                  },
                  {
                    path: "services/modules",
                    element: <LocalizationModulesPage />,
                  },
                  {
                    path: "services/modules/:moduleId",
                    element: <LocalizationModuleDetailPage />,
                  },
                  {
                    path: "services/language/export-history",
                    element: <LocalizationExportHistoryPage />,
                  },
                  {
                    path: "services/language/logs",
                    element: <LocalizationLogsPage />,
                  },
                  {
                    path: "services/language/translations/new-key",
                    element: <LocalizationNewKeyPage />,
                  },
                  {
                    path: "services/language/translations/:keyId",
                    element: <LocalizationKeyDetailPage />,
                  },
                  {
                    path: "services/glossary",
                    element: <LocalizationGlossaryPage />,
                  },
                  {
                    path: "services/glossary/:itemId",
                    element: <LocalizationGlossaryDetailPage />,
                  },
                ],
              },
            ],
          },
          { path: "/", element: <Navigate to="/app/console" replace /> },
          { path: "*", element: <Navigate to="/login" replace /> },
        ],
      },
    ],
  },
]);

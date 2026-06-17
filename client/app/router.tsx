import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import {
  AuthResolver,
  CallbackPage,
  ConsoleLayout,
  ConsolePage,
  DashboardLayout,
  DashboardOverview,
  EnvironmentsPage,
  LoginPage,
  ProfilePage,
  ProjectOverviewLayout,
  ProtectedGuard,
  PublicGuard,
} from "@seliseblocks/blocks-kit";
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
  "/services/language/translations/*": "/services/language",
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
        element: <CallbackPage redirectUrl="/console" />,
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
            element: (
              <ProtectedGuard>
                <Outlet />
              </ProtectedGuard>
            ),
            children: [
              {
                element: (
                  <ConsoleLayout>
                    <Outlet />
                  </ConsoleLayout>
                ),
                children: [
                  { path: "/profile", element: <ProfilePage /> },
                  { path: "/console", element: <ConsolePage /> },
                ],
              },
              {
                path: "/project-overview",
                element: (
                  <ProjectOverviewLayout
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}
                  >
                    <Outlet />
                  </ProjectOverviewLayout>
                ),
                children: [
                  {
                    path: "environments",
                    element: <EnvironmentsPage />,
                  },
                ],
              },
              {
                element: (
                  <DashboardLayout
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}
                  >
                    <Outlet />
                  </DashboardLayout>
                ),
                children: [
                  { path: "/dashboard", element: <DashboardOverview /> },
                  {
                    path: "/services/language",
                    element: <LocalizationLanguageHomePage />,
                  },
                  {
                    path: "/services/configure",
                    element: <LocalizationConfigurePage />,
                  },
                  {
                    path: "/services/modules",
                    element: <LocalizationModulesPage />,
                  },
                  {
                    path: "/services/modules/:moduleId",
                    element: <LocalizationModuleDetailPage />,
                  },
                  {
                    path: "/services/language/export-history",
                    element: <LocalizationExportHistoryPage />,
                  },
                  {
                    path: "/services/language/logs",
                    element: <LocalizationLogsPage />,
                  },
                  {
                    path: "/services/language/translations/new-key",
                    element: <LocalizationNewKeyPage />,
                  },
                  {
                    path: "/services/language/translations/:keyId",
                    element: <LocalizationKeyDetailPage />,
                  },
                  {
                    path: "/services/glossary",
                    element: <LocalizationGlossaryPage />,
                  },
                  {
                    path: "/services/glossary/:itemId",
                    element: <LocalizationGlossaryDetailPage />,
                  },
                ],
              },
            ],
          },
          { path: "/", element: <Navigate to="/console" replace /> },
          { path: "*", element: <Navigate to="/login" replace /> },
        ],
      },
    ],
  },
]);

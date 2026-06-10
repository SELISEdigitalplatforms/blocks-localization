import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
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
} from "./routes/dashboard/localization-pages";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { ProjectOverviewLayout } from "./layouts/project-overview-layout";
import { EnvironmentsPage } from "./pages/environments/environments";
import {
  AuthResolver,
  PublicGuard,
  LoginPage,
  ProtectedGuard,
  ConsoleLayout,
  ImpersonationChecker,
  ImpersonationTerminator,
  ImpersonationSynchronizer,
  ConsolePage,
  CallbackPage,
  ProfilePage,
} from "@seliseblocks/blocks-kit";
import { DashboardOverview } from "./pages/dashboard/dashboard-overview";

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    children: [
      // All Redirect Url Handle here
      {
        element: <Outlet />,
        children: [
          {
            path: "/login/callback",
            element: <CallbackPage redirectUrl="/console" />,
          },
        ],
      },
      {
        // Set User Auth Information and resolve authentication state before rendering any route
        element: (
          <AuthResolver>
            <Outlet />
          </AuthResolver>
        ),
        children: [
          // public
          {
            element: (
              <PublicGuard>
                <Outlet />
              </PublicGuard>
            ),
            children: [
              {
                path: "/login",
                element: <LoginPage />,
              },
            ],
          },

          // protected
          {
            element: (
              <ProtectedGuard>
                <Outlet />
              </ProtectedGuard>
            ),
            children: [
              {
                element: (
                  <ImpersonationChecker>
                    <ImpersonationTerminator>
                      <ConsoleLayout>
                        <Outlet />
                      </ConsoleLayout>
                    </ImpersonationTerminator>
                  </ImpersonationChecker>
                ),
                children: [
                  { path: "/profile", element: <ProfilePage /> },
                  { path: "/console", element: <ConsolePage /> },
                ],
              },
              {
                element: <ProjectOverviewLayout />,
                children: [
                  {
                    path: "/project-overview/environments",
                    element: <EnvironmentsPage />,
                  },
                ],
              },
              {
                // impersonate
                element: (
                  <ImpersonationChecker>
                    <ImpersonationSynchronizer>
                      <DashboardLayout />
                    </ImpersonationSynchronizer>
                  </ImpersonationChecker>
                ),
                children: [
                  { path: "/dashboard", element: <DashboardOverview /> },

                  {
                    path: "/services/language",
                    element: <LocalizationLanguageHomePage />,
                  },
                  {
                    path: "/services/language/translations",
                    element: <Navigate to="/services/language" replace />,
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

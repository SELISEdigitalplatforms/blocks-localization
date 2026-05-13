import { createBrowserRouter, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";

import { AuthLayout } from "./layouts/auth-layout";
import { PublicLayout } from "./layouts/public-layout";
import { OidcLayout } from "./layouts/oidc-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { ConsoleLayout } from "./layouts/console-layout";
import { ProjectOverviewLayout } from "./layouts/project-overview-layout";
// Auth routes (public, with auth layout)
import SignupPage from "./routes/auth/signup";
import SsoActivatePage from "./routes/auth/sso-activate";

// Public routes (with public guard only)
import ActivatePage from "./routes/auth/activate";
import ForgotPasswordPage from "./routes/auth/forgot-password";
import ResetPasswordPage from "./routes/auth/resetpassword";
import ActivateSuccessPage from "./routes/auth/activate-success";
import ForgotEmailSentPage from "./routes/auth/forgot-email-sent";
import SignupEmailSentPage from "./routes/auth/signup-email-sent";
import MfaCheckPage from "./routes/auth/mfa-check";
import ResetPasswordSuccessPage from "./routes/auth/reset-password-success";

// OIDC routes (un-guarded)
import OidcIndexPage from "./routes/oidc/index";
import OidcLoginPage from "./routes/oidc/login";
import OidcPermissionPage from "./routes/oidc/permission";
import OidcErrorPage from "./routes/oidc/error";
import OidcForgotPasswordPage from "./routes/oidc/forgot-password";
import OidcEmailSentConfirmationPage from "./routes/oidc/email-sent-confirmation";

// Dashboard routes (protected)
import AuthenticationConfigPage from "./routes/dashboard/authentication-config";
import SsoConfigurationPage from "./routes/dashboard/sso-configuration";
import {
  LocalizationConfigurePage,
  LocalizationExportHistoryPage,
  LocalizationGlossaryDetailPage,
  LocalizationGlossaryPage,
  LocalizationKeyDetailPage,
  LocalizationLanguageHomePage,
  LocalizationLogsPage,
  LocalizationModulesPage,
  LocalizationNewKeyPage,
} from "./routes/dashboard/localization-pages";
import ProfilePage from "./routes/dashboard/profile";

// Console routes
import { Console } from "./pages/console/console";
import { CreateProjectWrapper } from "./pages/create-project/create-project";

// Project overview routes
import { EnvironmentsPage } from "./pages/environments/environments";
import ProjectPeoplePage from "./routes/project-overview/people";
import ProjectRepositoriesPage from "./routes/project-overview/repositories";
import ProjectSettingsPage from "./routes/project-overview/settings";
import LoginSimplePage from "./routes/auth/login-simple";
import LoginCallbackPage from "./routes/auth/callback";
import CallbackPage from "./routes/callback/callback";

// ── Root redirect: conditionally redirects based on auth state ──
function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/services/language" replace />;
  }
  return <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  // ── Auth layout (login, signup, sso-activate) ──
  {
    element: <AuthLayout />,
    children: [
      { path: "/signup", element: <SignupPage /> },
      { path: "/sso-activate", element: <SsoActivatePage /> },
    ],
  },
  // ── Simple login (no guards, no API calls) ──
  {
    path: "/login",
    children: [
      { index: true, element: <LoginSimplePage /> },
      { path: "callback", element: <LoginCallbackPage /> },
    ],
  },
  // ── Public layout (other public pages with PublicGuard) ──
  
  {
    element: <PublicLayout />,
    children: [
      { path: "/activate", element: <ActivatePage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/resetpassword", element: <ResetPasswordPage /> },
      { path: "/activate-success", element: <ActivateSuccessPage /> },
      { path: "/forgot-email-sent", element: <ForgotEmailSentPage /> },
      { path: "/signup-email-sent", element: <SignupEmailSentPage /> },
      { path: "/mfa-check", element: <MfaCheckPage /> },
      { path: "/reset-password-success", element: <ResetPasswordSuccessPage /> },
    ],
  },

  // ── OIDC layout (un-guarded, themed) ──
  {
    path: "/oidc",
    element: <OidcLayout />,
    children: [
      { index: true, element: <OidcIndexPage /> },
      { path: "login", element: <OidcLoginPage /> },
      { path: "permission", element: <OidcPermissionPage /> },
      { path: "error", element: <OidcErrorPage /> },
      { path: "forgot-password", element: <OidcForgotPasswordPage /> },
      { path: "email-sent-confirmation", element: <OidcEmailSentConfirmationPage /> },
    ],
  },

  // ── Dashboard layout (protected routes — no project required) ──
  {
    element: <DashboardLayout />,
    children: [
      { path: "/services/authentication", element: <AuthenticationConfigPage /> },
      { path: "/services/authentication/sso-configuration", element: <SsoConfigurationPage /> },
      { path: "/services/language", element: <LocalizationLanguageHomePage /> },
      { path: "/services/language/translations", element: <Navigate to="/services/language" replace /> },
      { path: "/services/configure", element: <LocalizationConfigurePage /> },
      { path: "/services/modules", element: <LocalizationModulesPage /> },
      { path: "/services/language/export-history", element: <LocalizationExportHistoryPage /> },
      { path: "/services/language/logs", element: <LocalizationLogsPage /> },
      { path: "/services/language/translations/new-key", element: <LocalizationNewKeyPage /> },
      { path: "/services/language/translations/:keyId", element: <LocalizationKeyDetailPage /> },
      { path: "/services/glossary", element: <LocalizationGlossaryPage /> },
      { path: "/services/glossary/:itemId", element: <LocalizationGlossaryDetailPage /> },
    ],
  },

  // ── Project Overview layout (project must be selected) ──
  {
    element: <ProjectOverviewLayout />,
    children: [
      { path: "/project-overview", element: <Navigate to="/project-overview/environments" replace /> },
      { path: "/project-overview/environments", element: <EnvironmentsPage /> },
      { path: "/project-overview/people", element: <ProjectPeoplePage /> },
      { path: "/project-overview/repositories", element: <ProjectRepositoriesPage /> },
      { path: "/project-overview/settings", element: <ProjectSettingsPage /> },
    ],
  },

  // ── Console layout (profile, console pages without sidebar) ──
  {
    element: <ConsoleLayout />,
    children: [
      { path: "/profile", element: <ProfilePage /> },
      { path: "/console", element: <Console /> },
      { path: "/create-project", element: <CreateProjectWrapper /> },
      { path: "/callback", element: <CallbackPage /> },
    ],
  },

  // ── Root redirect: check auth first, then redirect appropriately ──
  { path: "/", element: <RootRedirect /> },

  // ── Catch-all: redirect to login ──
  { path: "*", element: <Navigate to="/login" replace /> },
]);

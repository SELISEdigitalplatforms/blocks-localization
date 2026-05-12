import { createBrowserRouter, Navigate } from "react-router-dom";

import { AuthLayout } from "./layouts/auth-layout";
import { PublicLayout } from "./layouts/public-layout";
import { OidcLayout } from "./layouts/oidc-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { ConsoleLayout } from "./layouts/console-layout";
// Auth routes (public, with auth layout)
import LoginPage from "./routes/auth/login";
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
import OidcLogin from "./routes/auth/oidc-login";

export const router = createBrowserRouter([
  // ── Auth layout (login, signup, sso-activate) ──
  {
    element: <AuthLayout />,
    children: [
      // { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/sso-activate", element: <SsoActivatePage /> },
    ],
  },
  // ── Simple login (no guards, no API calls) ──
  { path: "/login", element: <OidcLogin /> },
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

  // ── Dashboard layout (protected routes) ──
  {
    element: <DashboardLayout />,
    children: [
      { path: "/services/authentication", element: <AuthenticationConfigPage /> },
      { path: "/services/authentication/sso-configuration", element: <SsoConfigurationPage /> },
      { path: "/services/language", element: <LocalizationLanguageHomePage /> },
      { path: "/services/language/translations", element: <Navigate to="/services/language" replace /> },
      { path: "/services/language/configure", element: <LocalizationConfigurePage /> },      
      { path: "/services/language/modules", element: <LocalizationModulesPage /> },
      { path: "/services/language/export-history", element: <LocalizationExportHistoryPage /> },
      { path: "/services/language/logs", element: <LocalizationLogsPage /> },
      { path: "/services/language/translations/new-key", element: <LocalizationNewKeyPage /> },
      { path: "/services/language/translations/:keyId", element: <LocalizationKeyDetailPage /> },
      { path: "/services/glossary", element: <LocalizationGlossaryPage /> },
      { path: "/services/glossary/:itemId", element: <LocalizationGlossaryDetailPage /> },
    ],
  },

  // ── Console layout (profile, console pages without sidebar) ──
  {
    element: <ConsoleLayout />,
    children: [
      { path: "/profile", element: <ProfilePage /> }
    ],
  },  

  // ── Root redirect: authenticated users go to console ──
  { path: "/", element: <Navigate to="/services/language" replace /> },

  // ── Catch-all: redirect to login ──
  { path: "*", element: <Navigate to="/login" replace /> },
]);

import { ForgotPasswordStubPage, SsoActivateStubPage } from "./stubs";
import { LoginPage } from "@/features/auth/pages/login-page";
import { MfaCheckPage } from "@/features/auth/pages/mfa-check-page";
import { SignupEmailSentPage } from "@/features/auth/pages/signup-email-sent-page";
import { SignupPage } from "@/features/auth/pages/signup-page";
import type { RouteObject } from "react-router-dom";

export const publicRoutes: RouteObject[] = [
  { path: "/login", Component: LoginPage },
  { path: "/mfa-check", Component: MfaCheckPage },
  { path: "/sso-activate", Component: SsoActivateStubPage },
  { path: "/forgot-password", Component: ForgotPasswordStubPage },
  { path: "/signup", Component: SignupPage },
  { path: "/signup-email-sent", Component: SignupEmailSentPage },
];

import { AuthShell } from "@/features/auth/components/auth-shell";
import { PublicRoute } from "@/routing/guards/public-route";
import { Signup } from "@/features/auth/pages/signup";
import { PageMeta } from "@/seo/page-meta";

export function SignupPage() {
  return (
    <PublicRoute>
      <>
        <PageMeta title="Sign up" />
        <AuthShell>
          <Signup />
        </AuthShell>
      </>
    </PublicRoute>
  );
}

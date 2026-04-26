import { AuthShell } from "@/features/auth/components/auth-shell";
import { PublicRoute } from "@/routing/guards/public-route";
import { Signin } from "@/features/auth/pages/signin";
import { useSsoActivation } from "@/features/auth/hooks/use-sso-activation";
import { PageMeta } from "@/seo/page-meta";
import { Loader2 } from "lucide-react";

function LoginContent() {
  const { isPending } = useSsoActivation();

  return (
    <>
      <PageMeta title="Log in" />
      {isPending && (
        <div className="fixed bottom-0 left-0 right-0 top-0 z-50 flex items-center justify-center bg-muted/70">
          <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden />
        </div>
      )}
      <AuthShell>
        <Signin />
      </AuthShell>
    </>
  );
}

export function LoginPage() {
  return (
    <PublicRoute>
      <LoginContent />
    </PublicRoute>
  );
}

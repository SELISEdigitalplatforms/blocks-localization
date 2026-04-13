import { useBrandedLogoSrc } from "@/features/auth/components/auth-shell";
import { MfaCheckForm } from "@/features/auth/components/mfa-check-form";
import { PublicRoute } from "@/routing/guards/public-route";
import { PageMeta } from "@/seo/page-meta";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/platform/ui/components/card/card";
import { Navigate, useSearchParams } from "react-router-dom";

function MfaCheckContent() {
  const logoSrc = useBrandedLogoSrc();
  const [searchParams] = useSearchParams();
  const mfaTypeRaw = searchParams.get("mfa_type");
  const mfaType = mfaTypeRaw != null && mfaTypeRaw !== "" ? Number(mfaTypeRaw) : 0;

  const mfaTypeMessage =
    mfaType === 1
      ? "2-step verification enabled. Open your authenticator app and get the verification code. Enter the code here."
      : "2-step verification enabled. Check your email for the verification code. Enter the code here to continue.";

  return (
    <>
      <PageMeta title="Verify it’s you" />
      <div className="thin-scrollbar flex h-full min-h-0 flex-col items-center overflow-y-auto overscroll-y-contain bg-background">
        <div className="mb-4 mt-[136px] p-4">
          <img src={logoSrc} width={128} height={55} alt="SELISE Blocks logo" />
        </div>
        <Card className="mx-auto mt-16 w-full rounded border-solid border-background py-5 shadow-none sm:max-w-md sm:border-[#95ADC4]">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl leading-9">Verify it’s you</CardTitle>
            <CardDescription className="text-high-emphasis mt-3 text-xl font-normal leading-7">
              {mfaTypeMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MfaCheckForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function MfaCheckPage() {
  const [searchParams] = useSearchParams();
  const mfaId = searchParams.get("mfa_id");
  if (!mfaId) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PublicRoute>
      <MfaCheckContent />
    </PublicRoute>
  );
}

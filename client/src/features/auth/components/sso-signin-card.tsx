import { Button } from "@/platform/ui/components/button/button";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { getSocialLoginEndpoint } from "@/features/auth/services/auth-api";
import { sanitizeProviderUrl } from "@/features/auth/utils/sanitize-provider-url";
import type { SSO_PROVIDERS } from "@/features/auth/model/types";
import { SSO_IMAGE_PATHS } from "@/features/auth/assets/sso-images";
import { usePrefersDark } from "@/features/auth/hooks/use-prefers-dark";
import { HttpError } from "@/platform/api/idp-http";
import { useCallback, useMemo } from "react";

type SsoSigninCardProps = {
  provider: SSO_PROVIDERS;
  audience: string;
  label: string;
  withLabel?: boolean;
};

export function SsoSigninCard({ provider, audience, label, withLabel = false }: SsoSigninCardProps) {
  const dark = usePrefersDark();

  const imageSrc = useMemo(() => {
    const paths = SSO_IMAGE_PATHS[provider];
    if (dark && paths.dark) return paths.dark;
    return paths.light;
  }, [provider, dark]);

  const onClickHandler = useCallback(async () => {
    try {
      if (!audience || !provider) return showErrorToast({ errors: "Something went wrong" });

      sessionStorage.setItem("clicked_sso_provider", provider);
      sessionStorage.setItem("clicked_sso_audience", audience || "");

      const res = await getSocialLoginEndpoint({
        provider,
        audience,
        sendAsResponse: true,
      });

      if (res.error) return showErrorToast({ errors: String(res.error) });
      if (!res.providerUrl) return showErrorToast({ errors: "No redirect URL provided." });
      window.location.href = sanitizeProviderUrl(res.providerUrl);
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        showErrorToast({ errors: error.errors });
      } else if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  }, [audience, provider]);

  return (
    <Button type="button" variant="outline" className="w-full gap-2" onClick={onClickHandler}>
      <img src={imageSrc} width={16} height={20} alt={provider} className="h-5 w-4 object-contain" />
      {withLabel && <>Sign in with {label}</>}
    </Button>
  );
}

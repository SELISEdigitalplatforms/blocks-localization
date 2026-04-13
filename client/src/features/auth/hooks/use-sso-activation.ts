import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { signinBySso } from "@/features/auth/services/auth-api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { isMfaRequired } from "@/features/auth/model/types";

const SSO_GUARD_PREFIX = "sso_activated_";

function acquireGuard(state: string): boolean {
  const key = `${SSO_GUARD_PREFIX}${state}`;
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
  } catch {
    /* noop */
  }
  return false;
}

function releaseGuard(state: string): void {
  try {
    sessionStorage.removeItem(`${SSO_GUARD_PREFIX}${state}`);
  } catch {
    /* noop */
  }
}

function handleSsoError(error: unknown): void {
  const errorStr = JSON.stringify(error);
  if (errorStr.includes("user_not_found")) {
    const errorObj = error as { error?: { description?: string }; description?: string };
    const description = errorObj?.error?.description || errorObj?.description || "";
    const firstWord = description.split(" ")[0];
    const emailTarget = firstWord.includes("@") ? firstWord : "";
    const msg = `There is no account with this email${emailTarget ? ` (${emailTarget})` : ""}.`;
    showErrorToast({ errors: msg });
  } else if (errorStr.includes("state_data_not_found")) {
    showErrorToast({ errors: "Something went wrong." });
  } else if (isErrorWithErrors(error)) {
    showErrorToast({ errors: error.errors });
  } else {
    showErrorToast({ errors: "Something went wrong" });
  }
}

function getSsoActivationPath(url: string): string | null {
  const queryPart = url.split("?")[1];
  if (!queryPart) return null;

  const params = new URLSearchParams(queryPart);
  const username = params.get("username");
  const ssoCode = params.get("code");

  return username && ssoCode ? `/sso-activate?username=${username}&code=${ssoCode}` : null;
}

export function useSsoActivation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthenticated } = useAuthStore();
  const [isPending, setIsPending] = useState(false);
  const effectRan = useRef(false);

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  useEffect(() => {
    if (!code || !state) return;
    const ssoCode = code;
    const ssoState = state;
    if (effectRan.current) return;

    if (acquireGuard(ssoState)) {
      return;
    }

    effectRan.current = true;

    async function activate() {
      setIsPending(true);
      try {
        const res = await signinBySso(ssoCode, ssoState);

        const activationPath = res.sso_user_redirect_url
          ? getSsoActivationPath(res.sso_user_redirect_url)
          : null;
        if (activationPath) {
          navigate(activationPath, { replace: true });
          return;
        }

        if (isMfaRequired(res)) {
          navigate(
            `/mfa-check?mfa_id=${encodeURIComponent(res.mfaId)}&mfa_type=${res.mfaType}`,
            { replace: false },
          );
          return;
        }

        setAuthenticated();
        navigate("/console", { replace: true });
      } catch (error) {
        releaseGuard(ssoState);
        effectRan.current = false;
        handleSsoError(error);
        navigate("/login", { replace: true });
      } finally {
        setIsPending(false);
      }
    }

    void activate();
  }, [code, state, navigate, setAuthenticated]);

  return { isPending };
}

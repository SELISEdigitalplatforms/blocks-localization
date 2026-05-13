import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { userService } from "@/idp/iam/services/user.service";
import { API_BASES } from "@/constants/endpoint.constant";

export default function LoginCallbackPage() {
  const [searchParams] = useSearchParams();
  const hasProcessed = useRef(false);
  const { setAuthenticated, setUser } = useAuthStore();

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const tenantId = searchParams.get("tenant_id");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const apiBaseUrl = API_BASES.IDP;

    const callbackUrl = new URL("/api/idp/callback", apiBaseUrl);
    // Forward the callback parameters to backend
    if (code) callbackUrl.searchParams.set("code", code);
    if (state) callbackUrl.searchParams.set("state", state);
    if (error) callbackUrl.searchParams.set("error", error);
    if (tenantId) callbackUrl.searchParams.set("tenant_id", tenantId);

    const headers: Record<string, string> = {};
    if (tenantId) {
      headers["X-Blocks-Key"] = tenantId;
    }

    fetch(callbackUrl.toString(), { headers, credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setAuthenticated();
          // Fetch user data immediately so ProtectedGuard has it ready
          return userService.getUser();
        } else {
          window.location.href = "/login?error=callback_failed";
          return null;
        }
      })
      .then((userResponse) => {
        if (userResponse?.data) {
          setUser(userResponse.data);
        }
        window.location.href = "/services/language";
      })
      .catch(() => {
        window.location.href = "/login?error=callback_error";
      });
  }, [code, state, error, tenantId, setAuthenticated, setUser]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader className="h-12 w-12 animate-spin text-gray-500" />
    </div>
  );
}
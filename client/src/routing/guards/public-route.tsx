import { useAuthStore } from "@/features/auth/model/auth-store";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function PublicRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isMounted, setIsMounted] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isSsoCallback = !!(searchParams.get("code") && searchParams.get("state"));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (isSsoCallback) return;
    if (isAuthenticated) navigate("/console", { replace: true });
  }, [isAuthenticated, isMounted, isSsoCallback, navigate]);

  if (!isMounted) return null;
  if (isAuthenticated && !isSsoCallback) return null;
  return <div className="h-full min-h-0 w-full">{children}</div>;
}

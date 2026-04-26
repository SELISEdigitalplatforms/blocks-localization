import { useAuthStore } from "@/features/auth/model/auth-store";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isMounted, setIsMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!isAuthenticated) navigate("/login", { replace: true });
  }, [isAuthenticated, isMounted, navigate]);

  if (!isMounted || !isAuthenticated) return null;
  return <div className="h-full min-h-0 w-full">{children}</div>;
}

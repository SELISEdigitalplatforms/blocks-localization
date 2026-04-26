import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createQueryClient } from "@/platform/query/query-client";
import { setQueryClient } from "@/platform/query/query-client-holder";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    setQueryClient(queryClient);
    return () => setQueryClient(null);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

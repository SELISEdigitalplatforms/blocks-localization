import type { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;

export function setQueryClient(client: QueryClient | null): void {
  queryClient = client;
}

export function getQueryClient(): QueryClient | null {
  return queryClient;
}

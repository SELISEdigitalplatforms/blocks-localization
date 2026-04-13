import { ConsoleShell } from "@/features/console/components/console-shell";
import { ProtectedRoute } from "@/routing/guards/protected-route";
import { PageMeta } from "@/seo/page-meta";

function ConsoleInner() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-surface-app">
      <PageMeta title="Console" />
      <ConsoleShell />
    </div>
  );
}

export function ConsolePage() {
  return (
    <ProtectedRoute>
      <ConsoleInner />
    </ProtectedRoute>
  );
}

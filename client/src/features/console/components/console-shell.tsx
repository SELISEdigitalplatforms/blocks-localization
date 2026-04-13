import { DefaultDocStrip } from "@/features/console/components/default-doc-strip";
import { SelfProject } from "@/features/console/components/self-project";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useEffect } from "react";

export function ConsoleShell() {
  const resetSelectedProject = useConsoleProjectStore((s) => s.resetSelectedProject);

  useEffect(() => {
    resetSelectedProject();
  }, [resetSelectedProject]);

  return (
    <main className="thin-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto overscroll-y-contain p-4 pb-10 sm:mx-10 sm:gap-10 md:pb-12">
      <SelfProject />
      <DefaultDocStrip />
    </main>
  );
}

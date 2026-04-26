import { env } from "@/config/env";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type UilmProjectState = {
  /** Passed as `projectKey` on UILM API payloads (monolith often uses `selectedProject.tenantId`). */
  projectKey: string;
  setProjectKey: (key: string) => void;
};

export const useUilmProjectStore = create<UilmProjectState>()(
  persist(
    (set) => ({
      projectKey: env.uilmProjectKey ?? "",
      setProjectKey: (projectKey) => set({ projectKey }),
    }),
    {
      name: "uilm-project-key",
      partialize: (s) => ({ projectKey: s.projectKey }),
    },
  ),
);

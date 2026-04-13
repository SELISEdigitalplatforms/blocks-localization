import type { IProject } from "@/features/console/model/project";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConsoleProjectStore {
  projects: IProject[];
  selectedProject: IProject | null;
  selectedTenantGroup: string | null;
  setSelectedProject: (project: IProject) => void;
  resetSelectedProject: () => void;
  setProjects: (projects: IProject[]) => void;
  resetProject: () => void;
  reset: () => void;
  setTennantGroup: (tenantGroupId: string) => void;
  resetTennantGroup: () => void;
}

export const useConsoleProjectStore = create<ConsoleProjectStore>()(
  persist(
    (set) => ({
      projects: [],
      selectedProject: null,
      selectedTenantGroup: null,
      setSelectedProject(project) {
        set((state) => ({
          ...state,
          selectedProject: project,
          selectedTenantGroup: project.tenantGroupId,
        }));
      },
      resetSelectedProject() {
        set((state) => ({ ...state, selectedProject: null }));
      },
      setProjects(projects) {
        set((state) => ({ ...state, projects }));
      },
      resetProject() {
        set((state) => ({ ...state, projects: [] }));
      },
      reset() {
        set({ projects: [], selectedProject: null, selectedTenantGroup: null });
      },
      setTennantGroup(tenantGroupId) {
        set((state) => ({ ...state, selectedTenantGroup: tenantGroupId }));
      },
      resetTennantGroup() {
        set((state) => ({ ...state, selectedTenantGroup: null }));
      },
    }),
    { name: "uilm-react-console-project-store" },
  ),
);

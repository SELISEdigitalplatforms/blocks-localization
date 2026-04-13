import { create } from "zustand";
import { createProjectEnvironmentFormDefaultValue } from "@/features/create-project/form/create-project-environments-form/utils";
import { createProjectNamingFormDefaultValue } from "@/features/create-project/form/create-project-naming-form/utils";
import { createProjectResourcesFormDefaultValue } from "@/features/create-project/form/create-project-resources-form/utils";

export type CreateProjectFormTuple = [
  typeof createProjectNamingFormDefaultValue,
  typeof createProjectResourcesFormDefaultValue,
  typeof createProjectEnvironmentFormDefaultValue,
];

type CreateProjectFormStore = {
  formData: CreateProjectFormTuple;
  setFormData: (
    index: number,
    data: CreateProjectFormTuple[0] | CreateProjectFormTuple[1] | CreateProjectFormTuple[2],
  ) => void;
  resetFormData: () => void;
};

function freshFormData(): CreateProjectFormTuple {
  return [
    { ...createProjectNamingFormDefaultValue },
    { assets: [...createProjectResourcesFormDefaultValue.assets] },
    { environments: [...createProjectEnvironmentFormDefaultValue.environments] },
  ];
}

export const useCreateProjectFormStore = create<CreateProjectFormStore>((set, get) => ({
  formData: freshFormData(),
  setFormData: (index, data) => {
    const next: CreateProjectFormTuple = [...get().formData];
    next[index] = data as never;
    set({ formData: next });
  },
  resetFormData: () => set({ formData: freshFormData() }),
}));

export function shortGuidGenerator(length: number): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => letters[b % letters.length]).join("");
}

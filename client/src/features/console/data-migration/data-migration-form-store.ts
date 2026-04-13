import { create } from "zustand";

export interface IServiceOption {
  name: string;
  label: string;
  selected: boolean;
  overrideData: boolean;
}

export const environmentServiceSelectionFormDefaultValue = {
  sourceEnvironment: "",
  sourceEnvironmentName: "",
  targetEnvironment: "",
  targetEnvironmentName: "",
  services: [
    { name: "Email", label: "Email", selected: false, overrideData: false },
    { name: "Language", label: "Language", selected: false, overrideData: false },
  ] as IServiceOption[],
};

export const reviewConfirmFormDefaultValue = {
  confirmed: false,
};

interface DataMigrationFormState {
  formData: [typeof environmentServiceSelectionFormDefaultValue, typeof reviewConfirmFormDefaultValue];
  setFormData: (
    index: number,
    data:
      | typeof environmentServiceSelectionFormDefaultValue
      | typeof reviewConfirmFormDefaultValue,
  ) => void;
  resetFormData: () => void;
}

export const useDataMigrationFormState = create<DataMigrationFormState>((set, get) => ({
  formData: [environmentServiceSelectionFormDefaultValue, reviewConfirmFormDefaultValue],
  setFormData: (index, data) => {
    const state = get();
    const next = [...state.formData] as DataMigrationFormState["formData"];
    next[index] = data as never;
    set({ formData: next });
  },
  resetFormData: () =>
    set({
      formData: [environmentServiceSelectionFormDefaultValue, reviewConfirmFormDefaultValue],
    }),
}));

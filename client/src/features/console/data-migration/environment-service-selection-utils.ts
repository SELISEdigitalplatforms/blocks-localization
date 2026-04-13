import { z } from "zod";
import type { IServiceOption } from "./data-migration-form-store";

export const environmentServiceSelectionFormSchema = z.object({
  sourceEnvironment: z.string().min(1, "Source environment is required"),
  sourceEnvironmentName: z.string(),
  targetEnvironment: z.string().min(1, "Target environment is required"),
  targetEnvironmentName: z.string(),
  services: z
    .array(
      z.object({
        name: z.string(),
        label: z.string(),
        selected: z.boolean(),
        overrideData: z.boolean(),
      }),
    )
    .refine((services) => services.some((service) => service.selected), {
      message: "At least one service must be selected",
    }),
});

export type EnvironmentServiceSelectionValues = z.infer<typeof environmentServiceSelectionFormSchema>;

export const environmentServiceSelectionFormDefaultValue: EnvironmentServiceSelectionValues = {
  sourceEnvironment: "",
  sourceEnvironmentName: "",
  targetEnvironment: "",
  targetEnvironmentName: "",
  services: [
    { name: "Email", label: "Email", selected: false, overrideData: false },
    { name: "Language", label: "Language", selected: false, overrideData: false },
  ] as IServiceOption[],
};

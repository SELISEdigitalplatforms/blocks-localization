import { z } from "zod";

export interface CreateProjectAsset {
  id?: number;
  name: string;
  html_url: string;
  full_name: string;
}

export const createProjectResourcesFormDefaultValue: { assets: CreateProjectAsset[] } = {
  assets: [],
};

export const createProjectResourcesFormSchema = z.object({
  assets: z
    .array(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1, "Asset name is required"),
        html_url: z.string().url("Link must be a valid URL"),
        full_name: z.string().optional(),
      }),
    )
    .optional(),
});

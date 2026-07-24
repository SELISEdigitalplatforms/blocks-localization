import { describe, expect, it } from "vitest";

import {
  createProjectNamingFormDefaultValue,
  createProjectNamingFormSchema,
} from "./form/create-project-naming-form/utils";
import {
  createProjectEnvironmentFormDefaultValue,
  createProjectEnvironmentFormSchema,
  environmentOptions,
} from "./form/create-project-environments-form/utils";
import {
  CreateProjectResourcesFormDefaultValue,
  CreateProjectResourcesFormSchema,
} from "./form/create-project-resources-form/utils";
import { shortGuidGenerator, useCreateProjectFormState } from "./utils";

describe("create-project naming form", () => {
  it("should have an empty, unaccepted default", () => {
    expect(createProjectNamingFormDefaultValue).toEqual({
      name: "",
      isAcceptBlocksTerms: false,
      isUseBlocksExclusively: false,
    });
  });

  it("should reject a short name", () => {
    const result = createProjectNamingFormSchema.safeParse({
      name: "ab",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
    });
    expect(result.success).toBe(false);
  });

  it("should reject when terms are not accepted", () => {
    const result = createProjectNamingFormSchema.safeParse({
      name: "Valid Name",
      isAcceptBlocksTerms: false,
      isUseBlocksExclusively: true,
    });
    expect(result.success).toBe(false);
  });

  it("should accept a valid, fully-consented payload", () => {
    const result = createProjectNamingFormSchema.safeParse({
      name: "Valid Name",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject a name over 100 characters", () => {
    const result = createProjectNamingFormSchema.safeParse({
      name: "x".repeat(101),
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("create-project environments form", () => {
  it("should default to no environments", () => {
    expect(createProjectEnvironmentFormDefaultValue).toEqual({
      environments: [],
    });
  });

  it("should require at least one environment", () => {
    expect(createProjectEnvironmentFormSchema.safeParse({ environments: [] }).success).toBe(false);
    expect(
      createProjectEnvironmentFormSchema.safeParse({
        environments: [{ value: "dev" }],
      }).success,
    ).toBe(true);
  });

  it("should expose eight environment options", () => {
    expect(environmentOptions).toHaveLength(8);
  });
});

describe("create-project resources form", () => {
  it("should default to an empty assets list", () => {
    expect(CreateProjectResourcesFormDefaultValue).toEqual({ assets: [] });
  });

  it("should reject an asset with an invalid URL", () => {
    const result = CreateProjectResourcesFormSchema.safeParse({
      assets: [{ name: "repo", html_url: "not-a-url" }],
    });
    expect(result.success).toBe(false);
  });

  it("should accept a valid asset", () => {
    const result = CreateProjectResourcesFormSchema.safeParse({
      assets: [{ name: "repo", html_url: "https://github.com/x/y" }],
    });
    expect(result.success).toBe(true);
  });

  it("should treat assets as optional", () => {
    expect(CreateProjectResourcesFormSchema.safeParse({}).success).toBe(true);
  });
});

describe("create-project store (useCreateProjectFormState)", () => {
  it("setFormData should replace the entry at an index", () => {
    const naming = { name: "P", isAcceptBlocksTerms: true, isUseBlocksExclusively: true };
    useCreateProjectFormState.getState().setFormData(0, naming);
    expect(useCreateProjectFormState.getState().formData[0]).toEqual(naming);
  });

  it("resetFormData should restore defaults", () => {
    useCreateProjectFormState.getState().setFormData(0, {
      name: "changed",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
    });
    useCreateProjectFormState.getState().resetFormData();
    expect(useCreateProjectFormState.getState().formData[0]).toEqual(
      createProjectNamingFormDefaultValue,
    );
  });
});

describe("shortGuidGenerator", () => {
  it("should produce a lowercase string of the requested length", () => {
    const guid = shortGuidGenerator(8);
    expect(guid).toHaveLength(8);
    expect(guid).toMatch(/^[a-z]+$/);
  });

  it("should produce an empty string for length 0", () => {
    expect(shortGuidGenerator(0)).toBe("");
  });
});

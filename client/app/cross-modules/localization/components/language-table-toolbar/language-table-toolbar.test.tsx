import { fireEvent, renderHook, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import {
  LanguageTableToolbar,
  useKeysFilterQueryParams,
  useKeysSortQueryParams,
} from "./language-table-toolbar";

const nuqsWrapper = ({ children }: { children: ReactNode }) =>
  createElement(NuqsTestingAdapter, { searchParams: "" }, children);

describe("components/language-table-toolbar", () => {
  it("useKeysFilterQueryParams should default all params", () => {
    const { result } = renderHook(() => useKeysFilterQueryParams(), {
      wrapper: nuqsWrapper,
    });
    expect(result.current.queryParams).toMatchObject({
      pageNumber: 0,
      pageSize: 10,
      search: "",
      moduleIds: [],
      missingLanguages: [],
    });
  });

  it("useKeysSortQueryParams should default to KeyName ascending", () => {
    const { result } = renderHook(() => useKeysSortQueryParams(), {
      wrapper: nuqsWrapper,
    });
    expect(result.current.sortQueryParams).toEqual({
      property: "KeyName",
      isDescending: false,
    });
  });

  it("should render module and missing-translation filters", () => {
    renderWithProviders(
      <LanguageTableToolbar
        languageModulesData={[{ itemId: "m1", moduleName: "UILM" }]}
        languagesData={[{ languageCode: "en-US", languageName: "English" }]}
      />,
    );
    expect(screen.getAllByText("Modules").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing Translations").length).toBeGreaterThan(0);
  });

  it("should open the module filter and toggle a value", () => {
    renderWithProviders(
      <LanguageTableToolbar
        languageModulesData={[{ itemId: "m1", moduleName: "UILM" }]}
        languagesData={[]}
      />,
    );
    fireEvent.click(screen.getAllByText("Modules")[0]);
    fireEvent.click(screen.getByRole("option", { name: "UILM" }));
    // Reset appears once a filter differs from defaults.
    expect(screen.getAllByText("Reset").length).toBeGreaterThan(0);
  });

  it("should disable its filter controls when the table has no keys", () => {
    const { container } = renderWithProviders(
      <LanguageTableToolbar languageModulesData={[]} languagesData={[]} disabled />,
    );

    expect((container.querySelector("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByText("Modules")[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

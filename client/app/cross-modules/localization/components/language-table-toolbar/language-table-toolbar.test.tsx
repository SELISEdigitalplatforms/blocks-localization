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

  describe("Glossary issues filter", () => {
    const Probe = () => {
      const { queryParams } = useKeysFilterQueryParams();
      return <pre data-testid="params">{JSON.stringify(queryParams)}</pre>;
    };
    const params = () => JSON.parse(screen.getByTestId("params").textContent || "{}");
    const renderToolbar = (searchParams = "", glossaryIssueCount?: number) =>
      renderWithProviders(
        <>
          <LanguageTableToolbar
            languageModulesData={[]}
            languagesData={[]}
            glossaryIssueCount={glossaryIssueCount}
          />
          <Probe />
        </>,
        { searchParams },
      );
    // The desktop and mobile toolbars both render the filter; the first is the desktop one.
    const glossaryButton = () => screen.getAllByRole("button", { name: /Glossary issues/ })[0];

    it("toggles like the other filter buttons and returns to the first page (H11)", () => {
      renderToolbar("?pageNumber=4");

      expect(glossaryButton().getAttribute("aria-pressed")).toBe("false");
      expect(screen.queryByText("Reset")).toBeNull();

      fireEvent.click(glossaryButton());
      expect(params()).toMatchObject({ glossaryIssues: true, pageNumber: 0 });
      expect(glossaryButton().getAttribute("aria-pressed")).toBe("true");
      expect(screen.getAllByText("Reset").length).toBeGreaterThan(0);

      fireEvent.click(glossaryButton());
      expect(params()).toMatchObject({ glossaryIssues: false, pageNumber: 0 });
    });

    it("reads the filter from the URL and clears it with Reset", () => {
      renderToolbar("?glossaryIssues=true");

      expect(glossaryButton().getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(screen.getAllByText("Reset")[0]);
      expect(params()).toMatchObject({ glossaryIssues: false });
    });

    it("shows the issue count once it is known", () => {
      const { unmount } = renderToolbar("", undefined);
      expect(glossaryButton().textContent).toBe("Glossary issues");
      unmount();

      renderToolbar("", 7);
      expect(glossaryButton().textContent).toBe("Glossary issues7");
    });
  });
});

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";

// The two date branches and the generic fallback are only reachable through
// FilterToolbar's onChange. Stub the toolbar so each case can hand over an exact
// value, and keep the real useSortQueryParams the module also re-exports. This is a
// separate file because the sibling tests render the real toolbar.
vi.mock("@/components/filter-toolbar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/filter-toolbar")>();
  return {
    ...actual,
    FilterToolbar: ({
      onChange,
      onReset,
    }: {
      onChange: (key: string, value: unknown) => void;
      onReset: () => void;
    }) => (
      <div>
        <button
          onClick={() =>
            onChange("createDate", {
              from: new Date("2026-01-15T00:00:00.000Z"),
              to: new Date("2026-01-20T00:00:00.000Z"),
            })
          }
        >
          set-create
        </button>
        <button onClick={() => onChange("createDate", null)}>clear-create</button>
        <button
          onClick={() =>
            onChange("lastUpdateDate", {
              from: new Date("2026-02-01T00:00:00.000Z"),
              to: new Date("2026-02-05T00:00:00.000Z"),
            })
          }
        >
          set-updated
        </button>
        <button onClick={() => onChange("lastUpdateDate", null)}>clear-updated</button>
        <button onClick={() => onChange("moduleIds", ["m1", "m2"])}>set-modules</button>
        <button onClick={onReset}>do-reset</button>
      </div>
    ),
  };
});

import {
  LanguageTableToolbar,
  useKeysFilterQueryParams,
} from "./language-table-toolbar";

const Probe = () => {
  const { queryParams } = useKeysFilterQueryParams();
  return <pre data-testid="params">{JSON.stringify(queryParams)}</pre>;
};

const params = () => JSON.parse(screen.getByTestId("params").textContent || "{}");

const renderToolbar = (searchParams = "") =>
  renderWithProviders(
    <>
      <LanguageTableToolbar languageModulesData={[]} languagesData={[]} />
      <Probe />
    </>,
    { searchParams },
  );

describe("components/language-table-toolbar filters", () => {
  it("stores a created range as ISO strings", () => {
    renderToolbar();

    fireEvent.click(screen.getByText("set-create"));

    expect(params()).toMatchObject({
      createStartDate: "2026-01-15T00:00:00.000Z",
      createEndDate: "2026-01-20T00:00:00.000Z",
      pageNumber: 0,
    });
  });

  it("clears the created range when it is removed", () => {
    renderToolbar("?createStartDate=2026-01-15T00:00:00.000Z");

    fireEvent.click(screen.getByText("clear-create"));

    expect(params()).toMatchObject({ createStartDate: "", createEndDate: "" });
  });

  it("stores a last updated range as ISO strings", () => {
    renderToolbar();

    fireEvent.click(screen.getByText("set-updated"));

    expect(params()).toMatchObject({
      lastUpdateStartDate: "2026-02-01T00:00:00.000Z",
      lastUpdateEndDate: "2026-02-05T00:00:00.000Z",
    });
  });

  it("clears the last updated range when it is removed", () => {
    renderToolbar("?lastUpdateStartDate=2026-02-01T00:00:00.000Z");

    fireEvent.click(screen.getByText("clear-updated"));

    expect(params()).toMatchObject({ lastUpdateStartDate: "", lastUpdateEndDate: "" });
  });

  it("passes any other filter straight through and returns to the first page", () => {
    renderToolbar("?pageNumber=4");

    fireEvent.click(screen.getByText("set-modules"));

    expect(params()).toMatchObject({ moduleIds: ["m1", "m2"], pageNumber: 0 });
  });

  it("returns every filter to its default on reset", () => {
    renderToolbar("?moduleIds=m1&pageNumber=3&createStartDate=2026-01-15T00:00:00.000Z");

    fireEvent.click(screen.getByText("do-reset"));

    expect(params()).toMatchObject({
      moduleIds: [],
      pageNumber: 0,
      createStartDate: "",
    });
  });
});

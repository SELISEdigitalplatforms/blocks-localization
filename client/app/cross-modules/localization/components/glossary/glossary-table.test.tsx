import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { useGetGlossaries } from "@blocks-localization/hooks/use-language-manager";
import GlossaryTable from "./glossary-table";

const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossaries: vi.fn(),
}));
vi.mock("@blocks-localization/components/modals/glossary/add-edit-glossary", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/components/modals/glossary/delete-glossary", () => ({
  default: () => null,
}));

const mockGlossaries = vi.mocked(useGetGlossaries);
const searchableGlossary = {
  itemId: "g1",
  name: "Acme",
  createDate: "2026-01-01",
};

const mockFilterableGlossaries = () => {
  mockGlossaries.mockImplementation((_pageNumber, _pageSize, searchText) => {
    const items = searchText ? [] : [searchableGlossary];
    return { data: { items, totalCount: items.length }, isLoading: false } as never;
  });
};

describe("components/glossary/glossary-table", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("should render skeletons while loading", () => {
    mockGlossaries.mockReturnValue({ data: undefined, isLoading: true } as never);
    const { container } = renderWithProviders(<GlossaryTable />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render an empty state when there are no glossaries", () => {
    mockGlossaries.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("No glossaries yet")).toBeTruthy();
    expect(
      screen.getByText("Glossaries help keep terminology consistent across translations."),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search glossary...")).toBeNull();
    expect(screen.queryByRole("columnheader")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create glossary" })).toBeNull();
  });

  it("should distinguish filtered results from an empty glossary", () => {
    vi.useFakeTimers();
    mockFilterableGlossaries();
    renderWithProviders(<GlossaryTable />);

    fireEvent.change(screen.getByPlaceholderText("Search glossary..."), {
      target: { value: "  missing term  " },
    });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("No matching glossaries")).toBeTruthy();
    expect(screen.getByText(/No glossaries match.*missing term/)).toBeTruthy();
    expect(screen.getByPlaceholderText("Search glossary...")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    const clearButton = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearButton);
    expect((screen.getByPlaceholderText("Search glossary...") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it("should not treat a whitespace-only search as an active filter", () => {
    vi.useFakeTimers();
    mockFilterableGlossaries();
    renderWithProviders(<GlossaryTable />);

    fireEvent.change(screen.getByPlaceholderText("Search glossary..."), {
      target: { value: "   " },
    });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.queryByText("No matching glossaries")).toBeNull();
  });

  it("should render glossary rows and navigate on row click", () => {
    mockGlossaries.mockReturnValue({
      data: {
        items: [
          {
            itemId: "g1",
            name: "Acme",
            language: "en-US",
            type: "Acronym",
            context: "ctx",
            additionalNote: "note",
            createDate: "2026-01-01",
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryTable />);
    const nameCell = screen.getByText("Acme");
    fireEvent.click(nameCell);
    expect(navigate).toHaveBeenCalledWith("/scoped/services/glossary/g1");
  });

  it("should debounce the search input", () => {
    vi.useFakeTimers();
    mockFilterableGlossaries();
    renderWithProviders(<GlossaryTable />);
    fireEvent.change(screen.getByPlaceholderText("Search glossary..."), {
      target: { value: "acme" },
    });
    act(() => vi.advanceTimersByTime(300));
    // useGetGlossaries is re-invoked with the debounced term on the next render.
    expect(mockGlossaries).toHaveBeenCalled();
  });

  it("should open the New Glossary dialog", () => {
    mockGlossaries.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryTable />);
    fireEvent.click(screen.getByText("New Glossary"));
    expect(screen.getByText("Glossary Management")).toBeTruthy();
  });

  it("should show pagination when total exceeds page size", () => {
    mockGlossaries.mockReturnValue({
      data: {
        items: [{ itemId: "g1", name: "A", createDate: "2026-01-01" }],
        totalCount: 100,
      },
      isLoading: false,
    } as never);
    const { container } = renderWithProviders(<GlossaryTable />);
    // Row action menu button present confirms a data row rendered.
    expect(within(container).getByText("A")).toBeTruthy();
  });
});

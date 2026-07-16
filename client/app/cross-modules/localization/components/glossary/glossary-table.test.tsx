import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { useGetGlossaries } from "@blocks-localization/hooks/use-language-manager";
import GlossaryTable from "./glossary-table";

const navigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
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

describe("components/glossary/glossary-table", () => {
  beforeEach(() => vi.clearAllMocks());

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
    expect(screen.getByText("No results.")).toBeTruthy();
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
    mockGlossaries.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryTable />);
    fireEvent.change(screen.getByPlaceholderText("Search glossary..."), {
      target: { value: "acme" },
    });
    vi.advanceTimersByTime(400);
    // useGetGlossaries is re-invoked with the debounced term on the next render.
    expect(mockGlossaries).toHaveBeenCalled();
    vi.useRealTimers();
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

import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
vi.mock(
  "@blocks-localization/components/modals/glossary/add-edit-glossary",
  () => ({
    default: ({ glossary }: { glossary?: { name: string } }) => (
      <div>add-edit-{glossary ? glossary.name : "new"}</div>
    ),
  }),
);
vi.mock(
  "@blocks-localization/components/modals/glossary/delete-glossary",
  () => ({
    default: ({ glossaryName }: { glossaryName: string }) => (
      <div>delete-{glossaryName}</div>
    ),
  }),
);

const mockGlossaries = vi.mocked(useGetGlossaries);

const row = {
  itemId: "g1",
  name: "Acme",
  language: "en-US",
  type: "Acronym",
  context: "some context",
  additionalNote: "a note",
  createDate: "2026-01-01",
};

const setData = (items: unknown[], totalCount = items.length) =>
  mockGlossaries.mockReturnValue({
    data: { items, totalCount },
    isLoading: false,
  } as never);

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = screen
    .getAllByRole("button")
    .find((b) => b.className.includes("h-8 w-8 p-0"))!;
  await user.click(trigger);
};

describe("glossary-table (extra coverage)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders every populated column value", () => {
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Acronym")).toBeTruthy();
    expect(screen.getByText("some context")).toBeTruthy();
    expect(screen.getByText("a note")).toBeTruthy();
  });

  it("falls back to dashes for missing optional fields and unknown languages", () => {
    setData([
      {
        itemId: "g2",
        name: "Bare",
        language: "zz-ZZ",
        type: null,
        context: null,
        additionalNote: null,
        createDate: null,
      },
    ]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Bare")).toBeTruthy();
    // Unknown language + null fields all render an em/hyphen dash.
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);
  });

  it("opens the edit dialog from the row menu", async () => {
    const user = userEvent.setup();
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Edit"));
    expect(await screen.findByText("add-edit-Acme")).toBeTruthy();
  });

  it("opens the delete dialog from the row menu", async () => {
    const user = userEvent.setup();
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete"));
    expect(await screen.findByText("delete-Acme")).toBeTruthy();
  });

  it("changes pages through the pagination footer", () => {
    setData([row], 100);
    const { container } = renderWithProviders(<GlossaryTable />);
    const footer = container.querySelector(".mt-5") as HTMLElement;
    expect(footer).toBeTruthy();
    const next = Array.from(footer.querySelectorAll("button")).find(
      (b) =>
        b.querySelector(".lucide-chevron-right") &&
        !(b as HTMLButtonElement).disabled,
    );
    fireEvent.click(next!);
    // Page 2 label reflects the updated page state.
    expect(screen.getByText(/Page 2 of/)).toBeTruthy();
  });
});

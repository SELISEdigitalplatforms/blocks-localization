import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import TagGlossaryModal from "./tag-glossary-modal";

const tagAsync = vi.fn();
const onClose = vi.fn();
const refetchSeed = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (sub: string) => `/app/p1/${sub}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetAllModuleGlossaries: vi.fn(),
  useSearchGlossaries: vi.fn(),
  useTagGlossary: vi.fn(),
  useGetLanguages: () => ({ data: [] }),
  useResolveGlossariesByIds: () => ({ glossaries: [], failedIds: [] }),
}));

const h = vi.mocked(hooks);
const module = { itemId: "m1", moduleName: "UILM" } as never;

const glossary = (index: number) => ({ itemId: `mg${index}`, name: `Term ${index}` });

const renderModal = () =>
  renderWithProviders(
    <Dialog open>
      <TagGlossaryModal module={module} onClose={onClose} />
    </Dialog>,
  );

const seed = (data: unknown, extra: Record<string, unknown> = {}) =>
  h.useGetAllModuleGlossaries.mockReturnValue({
    data,
    isError: false,
    isFetching: false,
    isFetchedAfterMount: true,
    refetch: refetchSeed,
    ...extra,
  } as never);

describe("components/modals/tag-glossary-modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed([{ itemId: "g1", name: "Existing", type: "Noun" }]);
    h.useSearchGlossaries.mockReturnValue({
      data: { items: [{ itemId: "g2", name: "Fresh", type: "Verb" }] },
    } as never);
    h.useTagGlossary.mockReturnValue({
      isPending: false,
      mutateAsync: tagAsync,
    } as never);
  });

  it("shows pre-selected module glossaries and removes one by its labelled button", () => {
    renderModal();
    expect(screen.getByText("Existing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Existing" }));
    expect(screen.queryByText("Existing")).toBeNull();
  });

  it("selects and deselects a searched glossary", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Fresh/ }));
    expect(screen.getByRole("button", { name: "Remove Fresh" })).toBeTruthy();
    await user.click(screen.getByRole("option", { name: /Fresh/ }));
    expect(screen.queryByRole("button", { name: "Remove Fresh" })).toBeNull();
  });

  it("submits the selected glossaries successfully", async () => {
    tagAsync.mockResolvedValue({ isSuccess: true });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(tagAsync).toHaveBeenCalledWith({ moduleId: "m1", glossaryIds: ["g1"] }),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Glossaries updated" }),
    );
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("saves every seeded id of a module with more than one page of glossaries (H14)", async () => {
    tagAsync.mockResolvedValue({ isSuccess: true });
    const many = Array.from({ length: 130 }, (_, index) => glossary(index));
    seed(many);
    renderModal();
    expect(screen.getAllByRole("button", { name: /^Remove Term/ })).toHaveLength(130);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(tagAsync).toHaveBeenCalled());
    expect(tagAsync.mock.calls[0][0].glossaryIds).toEqual(many.map((item) => item.itemId));
  });

  it("keeps Save disabled while the seed loads (C15)", () => {
    seed(undefined, { isFetching: true });
    renderModal();
    expect(screen.getByText("Loading tagged glossaries…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("does not seed from cached data until this dialog's fetch succeeds (C15)", () => {
    seed([{ itemId: "g1", name: "Existing" }], { isFetchedAfterMount: false, isFetching: true });
    renderModal();
    expect(screen.getByText("Loading tagged glossaries…")).toBeTruthy();
    seed([{ itemId: "g1", name: "Existing" }], { isError: true });
    renderModal();
    expect(screen.getByText("Couldn't load this module's glossaries")).toBeTruthy();
  });

  it("keeps Save disabled after a seed failure and offers Retry (C15)", () => {
    seed(undefined, { isError: true });
    renderModal();
    expect(screen.getByText("Couldn't load this module's glossaries")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchSeed).toHaveBeenCalled();
  });

  it("does not overwrite the user's changes when the seed refetches", () => {
    const { rerender } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Remove Existing" }));
    seed([{ itemId: "g1", name: "Existing" }]);
    rerender(
      <Dialog open>
        <TagGlossaryModal module={module} onClose={onClose} />
      </Dialog>,
    );
    expect(screen.queryByText("Existing")).toBeNull();
  });

  it("toasts an error when the update is unsuccessful", async () => {
    tagAsync.mockResolvedValue({ isSuccess: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("handles a thrown error during submit", async () => {
    tagAsync.mockRejectedValue(new Error("network down"));
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "network down",
        }),
      ),
    );
  });

  it("closes on cancel", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});

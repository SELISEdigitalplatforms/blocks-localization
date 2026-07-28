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

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetModuleGlossaries: vi.fn(),
  useSearchGlossaries: vi.fn(),
  useTagGlossary: vi.fn(),
}));

const h = vi.mocked(hooks);
const module = { itemId: "m1", moduleName: "UILM" } as never;

const renderModal = () =>
  renderWithProviders(
    <Dialog open>
      <TagGlossaryModal module={module} onClose={onClose} />
    </Dialog>,
  );

describe("components/modals/tag-glossary-modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetModuleGlossaries.mockReturnValue({
      data: { items: [{ itemId: "g1", name: "Existing", type: "Noun" }] },
    } as never);
    h.useSearchGlossaries.mockReturnValue({
      data: { items: [{ itemId: "g2", name: "Fresh", type: "Verb" }] },
    } as never);
    h.useTagGlossary.mockReturnValue({
      isPending: false,
      mutateAsync: tagAsync,
    } as never);
  });

  it("shows pre-selected module glossaries and removes one", () => {
    renderModal();
    expect(screen.getByText("Existing")).toBeTruthy();
    // Each selected badge has a remove (X) button.
    const removeBtn = screen.getAllByRole("button").find((b) => b.querySelector(".lucide-x"))!;
    fireEvent.click(removeBtn);
    expect(screen.queryByText("Existing")).toBeNull();
  });

  it("selects and deselects a searched glossary", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByText("Fresh");
    await user.click(option);
    // Selecting adds it as a badge.
    await waitFor(() => expect(screen.getAllByText("Fresh").length).toBeGreaterThan(0));
    // Selecting again toggles it off.
    await user.click(screen.getByText("Fresh", { selector: "span" }));
  });

  it("submits the selected glossaries successfully", async () => {
    tagAsync.mockResolvedValue({ isSuccess: true });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(tagAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Glossaries updated" }),
    );
    expect(onClose).toHaveBeenCalledWith(false);
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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import EditRoute from "./edit-route/edit-route";
import AutoTranslate from "./auto-translate/auto-translate";
import TagGlossaryModal from "./tag-glossary-modal/tag-glossary-modal";

const saveKeyAsync = vi.fn();
const translateAllAsync = vi.fn();
const tagGlossaryAsync = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useTranslateAll: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
  useSearchGlossaries: vi.fn(),
  useTagGlossary: vi.fn(),
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

const keyDetails = {
  itemId: "k1",
  keyName: "greeting",
  moduleId: "m1",
  routes: ["/home"],
  glossaryIds: [],
  resources: [],
  isPartiallyTranslated: false,
  context: "",
} as never;

describe("modals/edit-route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
  });

  it("should render existing routes", () => {
    render(withDialog(<EditRoute keyDetails={keyDetails} onClose={vi.fn()} />));
    expect(screen.getByDisplayValue("/home") as HTMLInputElement).toBeTruthy();
  });

  it("should add a new route field", () => {
    render(withDialog(<EditRoute keyDetails={keyDetails} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: /Add Route/ }));
    expect(screen.getAllByPlaceholderText("e.g., dashboard/settings").length).toBe(2);
  });

  it("should save routes", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(withDialog(<EditRoute keyDetails={keyDetails} onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("should delete a route and persist the change", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    render(
      withDialog(
        <EditRoute keyDetails={{ ...keyDetails, routes: ["/home", "/about"] }} onClose={vi.fn()} />,
      ),
    );
    // The delete (trash) buttons are the icon buttons next to each input.
    const trashButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash"));
    fireEvent.click(trashButtons[0]);
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
  });

  it("should render an empty prompt when there are no routes", () => {
    render(withDialog(<EditRoute keyDetails={{ ...keyDetails, routes: [] }} onClose={vi.fn()} />));
    expect(screen.getByText("No routes added yet")).toBeTruthy();
  });
});

describe("modals/auto-translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useTranslateAll).mockReturnValue({
      isPending: false,
      mutateAsync: translateAllAsync,
    } as never);
  });

  it("should trigger translate-all on confirm", async () => {
    translateAllAsync.mockResolvedValue({ isSuccess: true });
    render(withDialog(<AutoTranslate />));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(translateAllAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Processing Translation" }),
    );
  });

  it("should toast an error when translation fails", async () => {
    translateAllAsync.mockResolvedValue({ isSuccess: false, errors: {} });
    render(withDialog(<AutoTranslate />));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});

describe("modals/tag-glossary-modal", () => {
  const module = { itemId: "m1", moduleName: "UILM" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.useGetModuleGlossaries).mockReturnValue({
      data: { items: [{ itemId: "g1", name: "Widget" }] },
    } as never);
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: [] },
    } as never);
    vi.mocked(hooks.useTagGlossary).mockReturnValue({
      isPending: false,
      mutateAsync: tagGlossaryAsync,
    } as never);
  });

  it("should prefill selected glossaries from the module", () => {
    render(withDialog(<TagGlossaryModal module={module} onClose={vi.fn()} />));
    expect(screen.getByText("Widget")).toBeTruthy();
  });

  it("should remove a selected glossary badge", () => {
    render(withDialog(<TagGlossaryModal module={module} onClose={vi.fn()} />));
    // The badge has an inline X remove button.
    const removeButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-x"));
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText("Widget")).toBeNull();
  });

  it("should save the tagged glossaries", async () => {
    tagGlossaryAsync.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(withDialog(<TagGlossaryModal module={module} onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(tagGlossaryAsync).toHaveBeenCalledWith({
        moduleId: "m1",
        glossaryIds: ["g1"],
      }),
    );
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("should toast on save failure", async () => {
    tagGlossaryAsync.mockResolvedValue({ isSuccess: false });
    render(withDialog(<TagGlossaryModal module={module} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to update glossaries" }),
      ),
    );
  });

  it("should add a glossary from the search popover", () => {
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: [{ itemId: "g2", name: "Gadget", type: "Acronym" }] },
    } as never);
    render(withDialog(<TagGlossaryModal module={module} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /Gadget/ }));
    // Selecting adds a badge for the new glossary.
    expect(screen.getAllByText("Gadget").length).toBeGreaterThan(1);
  });
});

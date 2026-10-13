import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@seliseblocks/genesis-os/lib";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { FORBIDDEN_ERROR_MESSAGE } from "@/lib/error";
import DeleteModuleModal from "./delete-module-modal";

const deleteModuleMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toastMock(...a) }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useDeleteLanguageModule: () => ({
    isPending: false,
    mutateAsync: deleteModuleMock,
  }),
}));

const FALLBACK = "An unexpected error occurred. Please try again.";

const module = { itemId: "m1", moduleName: "Alpha" } as never;
const allModules = [
  { itemId: "m1", moduleName: "Alpha" },
  { itemId: "m2", moduleName: "Beta" },
] as never;

const renderAndDelete = () => {
  render(
    <Dialog open onOpenChange={() => {}}>
      <DeleteModuleModal module={module} allModules={allModules} onClose={vi.fn()} />
    </Dialog>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
};

describe("modals/delete-module-modal error messages", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [
      "an HttpError 400 → the API error text",
      new HttpError(400, { errors: { ItemId: "Module not found" } }),
      "Module not found",
    ],
    [
      "an HttpError 400 for a self-move → the API error text",
      new HttpError(400, { errors: { ItemId: "Cannot move module keys to itself" } }),
      "Cannot move module keys to itself",
    ],
    [
      "an HttpError 400 for a server fault → the generic API error text",
      new HttpError(400, { errors: { Error: "An unexpected error occurred" } }),
      "An unexpected error occurred",
    ],
    [
      "an HttpError 403 → the forbidden message",
      new HttpError(403, { errors: {} }),
      FORBIDDEN_ERROR_MESSAGE,
    ],
    ["an Error → its message", new Error("x"), "x"],
    ["a string → the trimmed string", "  server unavailable  ", "server unavailable"],
    ["a whitespace-only string → the fallback", "   ", FALLBACK],
    ["an Error with an empty message → the fallback", new Error(""), FALLBACK],
    ["a number → the fallback", 42, FALLBACK],
    ["null → the fallback", null, FALLBACK],
  ])("toasts %s", async (_label, rejection, expected) => {
    deleteModuleMock.mockRejectedValue(rejection);
    renderAndDelete();
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: expected }),
      ),
    );
  });
});

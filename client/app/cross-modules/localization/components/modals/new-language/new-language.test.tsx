import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { useSaveLanguage } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import NewLanguage from "./new-language";

const saveAsync = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveLanguage: vi.fn(),
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

const NewLanguageDialogHarness = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>Open new language</DialogTrigger>
      {open && <NewLanguage onClose={(value) => setOpen(value ?? false)} />}
    </Dialog>
  );
};

describe("components/modals/new-language", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveLanguage).mockReturnValue({
      isPending: false,
      mutateAsync: saveAsync,
    } as never);
  });

  it("should render the language picker", () => {
    render(withDialog(<NewLanguage onClose={vi.fn()} />));
    expect(screen.getByText("New Language")).toBeTruthy();
    expect(screen.getByText("Select language")).toBeTruthy();
    expect(screen.getByText("*")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("should open the command dialog and select a language then save", async () => {
    saveAsync.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    render(withDialog(<NewLanguage onClose={onClose} />));

    fireEvent.click(screen.getByText("Select language"));
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[0]);
    const saveButton = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveAsync).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("should clear the selected language after closing and reopening", async () => {
    render(<NewLanguageDialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open new language" }));
    fireEvent.click(screen.getByText("Select language"));
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[0]);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Open new language" }));

    expect(screen.getByText("Select language")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("should mark an already added language and not let it be picked", async () => {
    render(
      withDialog(
        <NewLanguage
          onClose={vi.fn()}
          existingLanguages={[{ languageCode: "en-US", languageName: "English" }] as never}
        />,
      ),
    );
    fireEvent.click(screen.getByText("Select language"));
    const options = await screen.findAllByRole("option");
    const english = options.find((o) => /^English/.test(o.textContent ?? ""));
    expect(english?.textContent).toContain("Added");
    expect(english?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(english as HTMLElement);
    // The picker stays open and nothing is selected.
    expect(screen.getByPlaceholderText("Search by name or code...")).toBeTruthy();
    expect(english?.querySelector("svg")).toBeNull();
  });

  it("should find a language by its code", async () => {
    render(withDialog(<NewLanguage onClose={vi.fn()} />));
    fireEvent.click(screen.getByText("Select language"));
    fireEvent.change(await screen.findByPlaceholderText("Search by name or code..."), {
      target: { value: "bn-BD" },
    });
    const options = await screen.findAllByRole("option");
    expect(options.some((o) => /^Bengali/.test(o.textContent ?? ""))).toBe(true);
  });

  describe("H1 — Success closes dialog and shows toast", () => {
    it("should show success toast and close dialog when API returns success:true", async () => {
      saveAsync.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      render(withDialog(<NewLanguage onClose={onClose} />));

      fireEvent.click(screen.getByText("Select language"));
      const options = await screen.findAllByRole("option");
      fireEvent.click(options[0]);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saveAsync).toHaveBeenCalled());
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "success",
            title: "Success",
            description: "Language added successfully.",
          }),
        ),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith(false);
    });
  });

  describe("C2 — Failure keeps dialog open and shows error toast", () => {
    it("should NOT call onClose and show error toast when API returns success:false", async () => {
      saveAsync.mockResolvedValue({ success: false, errorMessage: "Tenant limit reached" });
      const onClose = vi.fn();
      render(withDialog(<NewLanguage onClose={onClose} />));

      fireEvent.click(screen.getByText("Select language"));
      const options = await screen.findAllByRole("option");
      fireEvent.click(options[0]);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saveAsync).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            title: "Error",
            description: "Tenant limit reached",
          }),
        ),
      );
      // Dialog should still be visible (New Language title still present)
      expect(screen.getByText("New Language")).toBeTruthy();
    });
  });

  describe("C3 — Exception keeps dialog open", () => {
    it("should NOT call onClose and show error toast when mutateAsync throws", async () => {
      saveAsync.mockRejectedValue(new Error("Network error"));
      const onClose = vi.fn();
      render(withDialog(<NewLanguage onClose={onClose} />));

      fireEvent.click(screen.getByText("Select language"));
      const options = await screen.findAllByRole("option");
      fireEvent.click(options[0]);
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saveAsync).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            title: "Error",
            description: "Network error",
          }),
        ),
      );
    });
  });

  describe("C5 — Failed save preserves selected language", () => {
    it("should preserve selected language in combobox after failed save", async () => {
      saveAsync.mockResolvedValue({ success: false, errorMessage: "Some error" });
      const onClose = vi.fn();
      render(withDialog(<NewLanguage onClose={onClose} />));

      fireEvent.click(screen.getByText("Select language"));
      const options = await screen.findAllByRole("option");
      // Find and click "English (en-US)"
      const english = options.find((o) => /English/.test(o.textContent ?? ""));
      fireEvent.click(english ?? options[0]);

      // Verify English is selected before save - button text shows language name
      expect(screen.getByText("English")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saveAsync).toHaveBeenCalled());
      expect(onClose).not.toHaveBeenCalled();

      // Verify combobox still shows the selected language after failed save
      expect(screen.getByText("English")).toBeTruthy();
    });
  });

  describe("Custom language", () => {
    const openCustom = async () => {
      fireEvent.click(screen.getByText("Not in the list? Add a custom language"));
      await screen.findByPlaceholderText("e.g. gsw-CH");
    };

    it("should offer the searched text as a custom language when nothing matches", async () => {
      render(withDialog(<NewLanguage onClose={vi.fn()} />));
      fireEvent.click(screen.getByText("Select language"));
      fireEvent.change(await screen.findByPlaceholderText("Search by name or code..."), {
        target: { value: "Klingon" },
      });
      fireEvent.click(await screen.findByText('Add "Klingon" as a custom language'));

      expect((screen.getByPlaceholderText("e.g. Swiss German") as HTMLInputElement).value).toBe(
        "Klingon",
      );
    });

    it("should open the custom form from the picker footer", async () => {
      render(withDialog(<NewLanguage onClose={vi.fn()} />));
      fireEvent.click(screen.getByText("Select language"));
      fireEvent.click(await screen.findByRole("button", { name: "Add custom language" }));

      expect(screen.getByPlaceholderText("e.g. gsw-CH")).toBeTruthy();
    });

    it("should fix the letter case of the code when leaving the field", async () => {
      render(withDialog(<NewLanguage onClose={vi.fn()} />));
      await openCustom();
      const code = screen.getByPlaceholderText("e.g. gsw-CH") as HTMLInputElement;

      fireEvent.change(code, { target: { value: "GSW-ch" } });
      fireEvent.blur(code);
      expect(code.value).toBe("gsw-CH");

      fireEvent.change(code, { target: { value: "EN-X-Cave" } });
      fireEvent.blur(code);
      expect(code.value).toBe("en-x-Cave");
    });

    it("should go back to the list", async () => {
      render(withDialog(<NewLanguage onClose={vi.fn()} />));
      await openCustom();
      fireEvent.click(screen.getByRole("button", { name: "Back to list" }));

      expect(screen.getByText("Select language")).toBeTruthy();
      expect(screen.queryByPlaceholderText("e.g. gsw-CH")).toBeNull();
    });

    it("should save a custom name and code", async () => {
      saveAsync.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      render(withDialog(<NewLanguage onClose={onClose} />));
      await openCustom();

      fireEvent.change(screen.getByPlaceholderText("e.g. Swiss German"), {
        target: { value: " Swiss German " },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g. gsw-CH"), {
        target: { value: "gsw-CH" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(saveAsync).toHaveBeenCalledWith({
          languageCode: "gsw-CH",
          languageName: "Swiss German",
        }),
      );
      expect(onClose).toHaveBeenCalledWith(false);
    });

    it("should block a code the server would reject", async () => {
      render(withDialog(<NewLanguage onClose={vi.fn()} />));
      await openCustom();

      fireEvent.change(screen.getByPlaceholderText("e.g. Swiss German"), {
        target: { value: "Swiss German" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g. gsw-CH"), {
        target: { value: "swiss" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Use a code like en-US, zho-CN or en-x-cave")).toBeTruthy();
      expect(saveAsync).not.toHaveBeenCalled();
    });

    it("should block a name that is too short", async () => {
      render(withDialog(<NewLanguage onClose={vi.fn()} />));
      await openCustom();

      fireEvent.change(screen.getByPlaceholderText("e.g. Swiss German"), {
        target: { value: "S" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g. gsw-CH"), {
        target: { value: "gsw-CH" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(
        await screen.findByText("Language name must be between 2 and 100 characters"),
      ).toBeTruthy();
      expect(saveAsync).not.toHaveBeenCalled();
    });

    it("should reject a custom language whose name is already added", async () => {
      render(
        withDialog(
          <NewLanguage
            onClose={vi.fn()}
            existingLanguages={[{ languageCode: "de-CH", languageName: "Swiss German" }] as never}
          />,
        ),
      );
      await openCustom();

      fireEvent.change(screen.getByPlaceholderText("e.g. Swiss German"), {
        target: { value: "swiss german" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g. gsw-CH"), {
        target: { value: "gsw-CH" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Language is already added. You can't add this language.",
          }),
        ),
      );
      expect(saveAsync).not.toHaveBeenCalled();
    });
  });
});

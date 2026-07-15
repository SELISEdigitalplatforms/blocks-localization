import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { KeyDetails } from "./key-details";

let params: Record<string, string> = { keyId: "k1" };
const translateKeyAsync = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useParams: () => params,
}));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/components/view-details/view-details", () => ({
  default: () => <div>ViewDetailsStub</div>,
}));
vi.mock("../timeline/timeline", () => ({
  default: ({ events }: { events: { description: string }[] }) => (
    <div>
      {events.map((e, i) => (
        <div key={i}>desc:{e.description}</div>
      ))}
    </div>
  ),
}));
vi.mock(
  "@blocks-localization/components/modals/delete-language-key/delete-language-key",
  () => ({ default: () => <div>DeleteKeyStub</div> }),
);
vi.mock("@blocks-localization/components/modals/gpt-prompt/gpt-prompt", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetBlocksLanguageKeyById: vi.fn(),
  useGetLanguageKeysTimeline: vi.fn(),
  useTranslateKey: vi.fn(),
}));

const h = vi.mocked(hooks);

const keyData = {
  itemId: "k1",
  keyName: "greeting",
  moduleId: "m1",
  resources: [],
  routes: [],
  glossaryIds: [],
  context: "ctx",
};

const route = "/app/abc/services/language/translations/k1";

describe("key-details (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = { keyId: "k1" };
    h.useGetBlocksLanguageKeyById.mockReturnValue({ data: keyData } as never);
    h.useGetLanguageKeysTimeline.mockReturnValue({
      data: { totalCount: 0, timelines: [] },
      isLoading: false,
    } as never);
    h.useTranslateKey.mockReturnValue({
      isPending: false,
      mutateAsync: translateKeyAsync,
    } as never);
  });

  it("maps every timeline log type to a description", async () => {
    const logTypes = [
      "TranslateAll",
      "TranslateKey",
      "KeyController.Save",
      "UilmImport.Update",
      "UilmImport.Insert",
      "KeyController.Delete",
      "KeyController.Create",
      "Rollback",
      "Published",
      "PublishFailed",
      "EnvironmentDataMigration",
      "SomethingUnknown",
    ];
    h.useGetLanguageKeysTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: logTypes.length,
        timelines: logTypes.map((logFrom, i) => ({
          itemId: `t${i}`,
          logFrom,
          userName: "Alice",
          userId: "u1",
          createDate: "2026-01-01T10:00:00Z",
        })),
      },
    } as never);
    renderWithProviders(<KeyDetails />, {
      route,
      searchParams: "?translationActivity=history",
    });
    expect(await screen.findByText("desc:Updated by translate all")).toBeTruthy();
    expect(screen.getByText("desc:Auto-translated by Alice")).toBeTruthy();
    expect(screen.getByText("desc:Updated manually by Alice.")).toBeTruthy();
    expect(screen.getByText("desc:Key deleted by Alice.")).toBeTruthy();
    expect(screen.getByText("desc:Key created by Alice.")).toBeTruthy();
    expect(screen.getByText("desc:Translate rolled back by Alice.")).toBeTruthy();
    expect(
      screen.getByText("desc:Key has been published by Alice."),
    ).toBeTruthy();
    expect(screen.getByText("desc:Key failed to publish.")).toBeTruthy();
    expect(
      screen.getByText("desc:A translation update action occurred."),
    ).toBeTruthy();
  });

  it("renders an empty message when a history page has no changes", () => {
    renderWithProviders(<KeyDetails />, {
      route,
      searchParams: "?translationActivity=history",
    });
    expect(screen.getByText("No changes found for this page.")).toBeTruthy();
  });

  it("shows a loading message while the timeline loads", () => {
    h.useGetLanguageKeysTimeline.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    renderWithProviders(<KeyDetails />, {
      route,
      searchParams: "?translationActivity=history",
    });
    expect(screen.getByText("Loading timeline…")).toBeTruthy();
  });

  it("renders pagination when the timeline exceeds one page", () => {
    h.useGetLanguageKeysTimeline.mockReturnValue({
      isLoading: false,
      data: {
        totalCount: 50,
        timelines: [
          {
            itemId: "t1",
            logFrom: "KeyController.Create",
            userName: "Alice",
            userId: "u1",
            createDate: "2026-01-01T10:00:00Z",
          },
        ],
      },
    } as never);
    renderWithProviders(<KeyDetails />, {
      route,
      searchParams: "?translationActivity=history",
    });
    expect(screen.getByText(/Page 1 of/)).toBeTruthy();
  });

  it("auto-translates the key successfully from the menu", async () => {
    const user = userEvent.setup();
    translateKeyAsync.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<KeyDetails />, { route });
    // Open the ellipsis dropdown and pick Auto-translate.
    const trigger = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-ellipsis-vertical"))!;
    await user.click(trigger);
    await user.click(await screen.findByText("Auto-translate"));
    // The confirm dialog appears; click Yes.
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(translateKeyAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Key translation in progress." }),
    );
  });

  it("toasts an error when auto-translate returns errors", async () => {
    const user = userEvent.setup();
    translateKeyAsync.mockResolvedValue({ isSuccess: false, errors: ["x"] });
    renderWithProviders(<KeyDetails />, { route });
    const trigger = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-ellipsis-vertical"))!;
    await user.click(trigger);
    await user.click(await screen.findByText("Auto-translate"));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("handles a thrown error during auto-translate", async () => {
    const user = userEvent.setup();
    translateKeyAsync.mockRejectedValue(new Error("boom"));
    renderWithProviders(<KeyDetails />, { route });
    const trigger = screen
      .getAllByRole("button")
      .find((b) => b.querySelector(".lucide-ellipsis-vertical"))!;
    await user.click(trigger);
    await user.click(await screen.findByText("Auto-translate"));
    await user.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("opens the delete dialog from the details toolbar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<KeyDetails />, { route });
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    expect(await screen.findByText("DeleteKeyStub")).toBeTruthy();
  });
});

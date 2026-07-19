import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRevertKeyTimeline } from "@blocks-localization/hooks/use-language-manager";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import Timeline from "./timeline";

const rollbackMock = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useRevertKeyTimeline: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

const events = [
  {
    id: "e1",
    date: "2026-01-01",
    time: "10:00",
    description: "Created key",
    previousData: [{ resources: [{ culture: "en-US", value: "Hi" }] }],
    currentData: [{ resources: [{ culture: "en-US", value: "Hello" }] }],
  },
  {
    id: "e2",
    date: "2026-01-02",
    time: "11:00",
    description: "Published",
    logFrom: "Published",
  },
] as never;

describe("language-module/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRevertKeyTimeline).mockReturnValue({
      isPending: false,
      mutateAsync: rollbackMock,
    } as never);
  });

  it("should render each event description", () => {
    render(<Timeline events={events} />);
    expect(screen.getByText("Created key")).toBeTruthy();
    expect(screen.getByText("Published")).toBeTruthy();
  });

  it("should open the difference dialog on row click", () => {
    render(<Timeline events={events} />);
    fireEvent.click(screen.getByText("Created key"));
    expect(screen.getByText("Language Difference")).toBeTruthy();
    // The culture row shows previous/current values.
    expect(screen.getByText("Hi")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("should show 'No changes published' for an empty published event", () => {
    render(<Timeline events={events} />);
    fireEvent.click(screen.getByText("Published"));
    expect(screen.getByText("No changes published.")).toBeTruthy();
  });

  it("should revert a change through the confirmation dialog", async () => {
    vi.useFakeTimers();
    rollbackMock.mockResolvedValue({ isSuccess: true });
    render(<Timeline events={events} />);

    // The first event has previousData → a Revert button is shown.
    fireEvent.click(screen.getByText("Revert"));
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    // Confirmation dialog Revert button.
    const confirmButtons = screen.getAllByText("Revert");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await act(async () => {});
    vi.useRealTimers();

    await waitFor(() => expect(rollbackMock).toHaveBeenCalled());
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it("should show an error toast when revert fails", async () => {
    rollbackMock.mockResolvedValue({ isSuccess: false, errors: { x: "no" } });
    render(<Timeline events={events} />);
    fireEvent.click(screen.getByText("Revert"));
    await waitFor(() => expect(screen.getByText("Confirmation")).toBeTruthy());
    const confirmButtons = screen.getAllByText("Revert");
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOptionalWindowContext } from "./ContentWindowStateContext";
import { DockPopover } from "./DockPopover";
import { WindowStoreImpl } from "./windowStore";

const stores = vi.hoisted(() => ({
  windows: undefined as WindowStoreImpl | undefined,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: stores.windows }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

function OpensSomething() {
  const dismiss = useOptionalWindowContext()?.dismissFlyout;
  return (
    <button type="button" onClick={() => dismiss?.()}>
      Open a run
    </button>
  );
}

function dockHere(id: string, title: string, content = <p>{title} body</p>) {
  stores.windows?.openWindow(content, {
    id,
    title,
    defaultDockState: "right",
  });
}

function renderPopover() {
  return render(
    <DockPopover side="right" icon="LayoutList" trackingId="test.toggle" />,
  );
}

describe("DockPopover", () => {
  beforeEach(() => {
    stores.windows = new WindowStoreImpl();
  });

  it("hides while nothing is docked, and shows during a drag to drop on", () => {
    renderPopover();
    expect(screen.queryByRole("button")).toBeNull();

    act(() => stores.windows?.beginWindowDrag("projects"));
    const button = screen.getByRole("button", { name: "Drop a window here" });
    expect(button).toHaveAttribute("data-drop-target", "ready");

    act(() =>
      stores.windows?.setWindowDragPreview({
        type: "dock-target",
        side: "right",
      }),
    );
    expect(button).toHaveAttribute("data-drop-target", "active");

    act(() => stores.windows?.endWindowDrag());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stacks its windows, each folding to its header", async () => {
    const user = userEvent.setup();
    dockHere("card", "Project contents");
    dockHere("projects", "Projects");
    renderPopover();

    await user.click(
      screen.getByRole("button", { name: "Project contents, Projects" }),
    );
    expect(screen.getByText("Project contents body")).toBeInTheDocument();
    expect(screen.getByText("Projects body")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Fold Project contents" }),
    );
    expect(screen.queryByText("Project contents body")).toBeNull();
    expect(screen.getByText("Projects body")).toBeInTheDocument();
    expect(stores.windows?.getWindowById("card")?.isMinimized).toBe(true);
  });

  it("closes when a window opens something from it", async () => {
    const user = userEvent.setup();
    dockHere("card", "Project contents", <OpensSomething />);
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Project contents" }));
    await user.click(screen.getByRole("button", { name: "Open a run" }));

    expect(screen.queryByRole("button", { name: "Open a run" })).toBeNull();
    expect(stores.windows?.isDockPopoverOpen("right")).toBe(false);
  });

  it("closes once a window is dragged, so the page behind is free", async () => {
    const user = userEvent.setup();
    dockHere("card", "Project contents");
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Project contents" }));
    act(() => stores.windows?.beginWindowDrag("card"));

    expect(screen.queryByText("Project contents body")).toBeNull();
  });
});

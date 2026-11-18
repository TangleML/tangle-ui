import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

const stores = vi.hoisted(() => ({
  windows: undefined as WindowStoreImpl | undefined,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: stores.windows }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", InertObserver);
  vi.stubGlobal("ResizeObserver", InertObserver);
});

function leftDock() {
  const windows = new WindowStoreImpl();
  windows.enableDockSide("left");
  windows.openWindow(<p>Projects body</p>, {
    id: "projects",
    title: "Projects",
    defaultDockState: "left",
    fillDockHeight: true,
    minDockedHeight: 320,
  });
  stores.windows = windows;
  return windows;
}

function addCard(windows: WindowStoreImpl) {
  windows.openWindow(<p>Card body</p>, {
    id: "card",
    title: "Project contents",
    defaultDockState: "left",
  });
}

function projectsContent(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    '[data-dock-window-content="projects"]',
  );
}

describe("DockArea", () => {
  it("lets a fill window that's alone fill the dock, down to its minimum", () => {
    leftDock();
    const { container } = render(<DockArea side="left" />);

    const content = projectsContent(container);
    expect(content).toHaveClass("flex-1");
    expect(content?.style.minHeight).toBe("320px");
  });

  it("shows all of a fill window sharing the dock, even beside a folded one", () => {
    const windows = leftDock();
    addCard(windows);
    windows.getWindowById("card")?.minimize();
    const { container } = render(<DockArea side="left" scrollsAsOne />);

    const content = projectsContent(container);
    expect(content).toHaveClass("shrink-0");
    expect(content).not.toHaveClass("flex-1");
    expect(
      content?.firstElementChild,
      "no minimum to pad a short list with",
    ).not.toHaveStyle({ minHeight: "320px" });
  });

  it("fades its bottom while there's more to scroll to", () => {
    const windows = leftDock();
    addCard(windows);
    const { container } = render(<DockArea side="left" />);
    const scroller = container.querySelector<HTMLElement>("[data-dock-scroll]");
    if (!scroller) throw new Error("The dock didn't render its column");
    Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
    Object.defineProperty(scroller, "clientHeight", { value: 600 });

    fireEvent.scroll(scroller);
    expect(container.querySelector("[data-dock-more-below]")).not.toBeNull();

    scroller.scrollTop = 600;
    fireEvent.scroll(scroller);
    expect(container.querySelector("[data-dock-more-below]")).toBeNull();
  });

  it("lets a fill window take the room left beside others unless the dock scrolls as one", () => {
    const windows = leftDock();
    addCard(windows);
    const { container } = render(<DockArea side="left" />);

    const content = projectsContent(container);
    expect(content).toHaveClass("flex-1");
    expect(
      container.querySelector('[data-dock-window-content="card"]'),
    ).toHaveClass("shrink-0");
  });

  it("gives quiet headers a fold button that says whether the window is open", () => {
    const windows = leftDock();
    addCard(windows);
    render(<DockArea side="left" quietHeaders />);

    expect(screen.queryByRole("button", { name: "Minimize" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fold Projects" }));

    expect(windows.getWindowById("projects")?.isMinimized).toBe(true);
    expect(
      screen.getByRole("button", { name: "Unfold Projects" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Card body")).toBeInTheDocument();
  });
});

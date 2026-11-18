import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  SharedStoreProvider,
  type SharedUIStore,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { SharedStoreRegistrar } from "@/routes/v2/shared/store/SharedStoreRegistrar";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { DockPopover } from "@/routes/v2/shared/windows/DockPopover";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

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

/**
 * A page whose right dock is a popover, with a pipeline or run embedded in it
 * that has a window store, and a right dock, of its own.
 */
function renderPageWithEmbeddedView(embeddedRightDock: ReactNode) {
  const stores: { page?: WindowStoreImpl; embedded?: WindowStoreImpl } = {};
  render(
    <SharedStoreProvider>
      <SharedStoreRegistrar
        onReady={(store: SharedUIStore) => (stores.page = store.windows)}
      />
      <DockPopover side="right" icon="LayoutList" trackingId="test.page" />
      <WindowContainer />
      <SharedStoreProvider>
        <SharedStoreRegistrar
          onReady={(store: SharedUIStore) => (stores.embedded = store.windows)}
        />
        <WindowContainer />
        {embeddedRightDock}
      </SharedStoreProvider>
    </SharedStoreProvider>,
  );
  if (!stores.page || !stores.embedded) {
    throw new Error("The window stores didn't mount");
  }
  return { page: stores.page, embedded: stores.embedded };
}

function open(
  windows: WindowStoreImpl,
  id: string,
  title: string,
  defaultDockState?: "right",
) {
  act(() => {
    windows.openWindow(<p>{title} body</p>, { id, title, defaultDockState });
  });
}

function placeButton(name: string, left: number, top: number) {
  vi.spyOn(
    screen.getByRole("button", { name }),
    "getBoundingClientRect",
  ).mockReturnValue(new DOMRect(left, top, 28, 28));
}

function startDragging(title: string) {
  fireEvent.mouseDown(screen.getByText(title), { clientX: 300, clientY: 300 });
  fireEvent.mouseMove(document, { clientX: 320, clientY: 320 });
}

function dropAt(x: number, y: number) {
  fireEvent.mouseMove(document, { clientX: x, clientY: y });
  fireEvent.mouseUp(document);
}

describe("useWindowDrag", () => {
  it("lets an embedded view's window dock at its own right edge, and not on the page's popover dock button", () => {
    const { page, embedded } = renderPageWithEmbeddedView(
      <DockArea side="right" />,
    );
    open(page, "assets", "Assets", "right");
    open(embedded, "properties", "Properties");
    placeButton("Assets", 900, 10);

    startDragging("Properties");
    dropAt(910, 20);
    expect(embedded.getWindowById("properties")?.dockState).toBe("none");

    startDragging("Properties");
    dropAt(window.innerWidth - 1, 300);
    expect(embedded.getWindowById("properties")?.dockState).toBe("right");
    expect(page.getDockedWindowOrder("right")).toEqual(["assets"]);
  });

  it("drops a window on its own store's popover dock button, not on another store's", () => {
    const { page, embedded } = renderPageWithEmbeddedView(
      <DockPopover side="right" icon="LayoutList" trackingId="test.embedded" />,
    );
    open(page, "assets", "Assets", "right");
    open(page, "projects", "Projects");
    open(embedded, "details", "Run details", "right");
    placeButton("Assets", 900, 10);
    placeButton("Run details", 500, 300);

    startDragging("Projects");
    // A dock registers its button again each time it redraws, which is when a
    // registry shared between stores would hand the side to the other one.
    act(() => embedded.getWindowById("details")?.setTitle("Run 42"));
    dropAt(510, 310);
    expect(page.getWindowById("projects")?.dockState).toBe("none");

    startDragging("Projects");
    act(() => embedded.getWindowById("details")?.setTitle("Run details"));
    dropAt(910, 20);
    expect(page.getDockedWindowOrder("right")).toEqual(["assets", "projects"]);
    expect(embedded.getDockedWindowOrder("right")).toEqual(["details"]);
  });
});

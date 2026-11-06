import { act, fireEvent, render, screen } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { type ReactNode, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

import { TangentProjectWorkspace } from "./TangentProjectWorkspace";

let store: TangentProjectStore;
let dock = observable({ collapsed: false, width: 320 });
let measureRow: (width: number) => void;
const providerMounted = vi.fn();
const providerUnmounted = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: { getDockAreaConfig: () => dock } }),
}));
vi.mock("@/routes/v2/shared/windows/windowPersistence", () => ({
  useWindowPersistence: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows", () => ({
  useTangentProjectWindows: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useNarrowLayoutDock", () => ({
  useNarrowLayoutDock: vi.fn(),
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentSessionParam", () => ({
  useTangentSessionParam: vi.fn(),
}));
vi.mock("@/routes/v2/shared/windows/DockArea", () => ({
  DockArea: () => null,
}));
vi.mock("@/routes/v2/shared/windows/WindowContainer", () => ({
  WindowContainer: () => null,
}));
vi.mock("@/services/projects/useProjects", () => ({
  useProject: () => ({ data: undefined }),
}));
vi.mock("@/routes/v2/pages/Tangent/workarea/registry", () => ({
  getWorkareaKind: vi.fn(),
  registerWorkareaKind: vi.fn(),
}));
vi.mock("./ProjectChatArea", () => ({
  ProjectChatArea: () => <div data-testid="chat">Chat</div>,
}));
vi.mock("./TangentProjectAgentProvider", () => ({
  TangentProjectAgentProvider: ({ children }: { children: ReactNode }) => (
    <AgentProviderProbe>{children}</AgentProviderProbe>
  ),
}));
vi.mock("@/components/ui/resize-handle", () => ({
  VerticalResizeHandle: ({
    onResizeEnd,
  }: {
    onResizeEnd: (width: number) => void;
  }) => <button aria-label="Resize chat" onClick={() => onResizeEnd(700)} />,
}));

function AgentProviderProbe({ children }: { children: ReactNode }) {
  useEffect(() => {
    providerMounted();
    return () => {
      providerUnmounted();
    };
  }, []);
  return children;
}

class RowResizeObserver implements ResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    measureRow = (width) => {
      this.callback(
        [
          {
            target,
            contentRect: new DOMRectReadOnly(0, 0, width, 1000),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    };
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", RowResizeObserver);
  store = new TangentProjectStore("project-1");
  dock = observable({ collapsed: false, width: 320 });
});

describe("workarea split layout", () => {
  it("releases all workarea layout space, removes the divider, and restores the last expanded split", () => {
    render(<TangentProjectWorkspace />);
    act(() => measureRow(2000));
    const chat = screen.getByTestId("chat").parentElement;
    expect(chat).toHaveStyle({ width: "480px" });
    fireEvent.click(screen.getByRole("button", { name: "Resize chat" }));
    expect(chat).toHaveStyle({ width: "700px" });
    const pane = document.getElementById("tangent-project-workarea");

    fireEvent.click(screen.getByRole("button", { name: "Hide workarea" }));
    expect(pane).toHaveStyle({ display: "none" });
    expect(chat?.style.width).toBe("");
    expect(chat).toHaveClass("flex-1", "min-w-0", "w-0");
    expect(chat).not.toHaveClass("shrink-0");
    expect(
      screen.queryByRole("button", { name: "Resize chat" }),
    ).not.toBeInTheDocument();
    expect(providerMounted).toHaveBeenCalledOnce();
    expect(providerUnmounted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Show workarea" }));
    expect(chat).toHaveStyle({ width: "700px" });
    expect(document.getElementById("tangent-project-workarea")).toBe(pane);
    expect(pane).toBeVisible();
  });

  it("clamps at a changed viewport/dock without recording collapsed measurements as user sizing", () => {
    render(<TangentProjectWorkspace />);
    act(() => measureRow(2000));
    fireEvent.click(screen.getByRole("button", { name: "Resize chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide workarea" }));
    act(() => measureRow(0));
    act(() => measureRow(1300));
    act(() =>
      runInAction(() => {
        dock.width = 400;
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show workarea" }));
    const chat = screen.getByTestId("chat").parentElement;
    expect(chat).toHaveStyle({ width: "480px" });
    act(() => measureRow(2000));
    expect(chat).toHaveStyle({ width: "700px" });
  });
});

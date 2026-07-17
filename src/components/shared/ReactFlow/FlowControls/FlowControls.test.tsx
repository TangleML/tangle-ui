import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactFlowProps, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FlowControls from "./FlowControls";

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const config: ReactFlowProps = {
  nodesDraggable: true,
  panOnDrag: true,
  selectionOnDrag: false,
};

function renderControls({
  updateConfig = vi.fn(),
  onAutoLayout = vi.fn(),
}: {
  updateConfig?: (updatedConfig: Partial<ReactFlowProps>) => void;
  onAutoLayout?: () => void;
} = {}) {
  render(
    <ReactFlowProvider>
      <FlowControls
        config={config}
        updateConfig={updateConfig}
        onAutoLayout={onAutoLayout}
        showInteractive={false}
      />
    </ReactFlowProvider>,
  );

  return { updateConfig, onAutoLayout };
}

describe("FlowControls", () => {
  it("renders viewport controls and toggles canvas interaction modes", () => {
    const { updateConfig } = renderControls();

    expect(screen.getByLabelText("Zoom In")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom Out")).toBeInTheDocument();
    expect(screen.getByLabelText("Fit View")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lock nodes" }));
    expect(updateConfig).toHaveBeenCalledWith({ nodesDraggable: false });
    expect(
      screen.getByRole("button", { name: "Unlock nodes" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Enable area selection" }),
    );
    expect(updateConfig).toHaveBeenCalledWith({
      selectionOnDrag: true,
      panOnDrag: false,
    });
  });

  it("runs the selected auto-layout algorithm", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const { onAutoLayout } = renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Auto layout" }));
    fireEvent.click(screen.getByRole("button", { name: /Sugiyama.*Layered/ }));

    await waitFor(() => expect(onAutoLayout).toHaveBeenCalledWith("sugiyama"));
  });
});

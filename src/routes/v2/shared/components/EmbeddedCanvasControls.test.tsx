import { render, screen, within } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { EmbeddedCanvasControls } from "./EmbeddedCanvasControls";

function renderControls(readOnly?: boolean) {
  render(
    <ReactFlowProvider>
      <EmbeddedCanvasControls label="Run view controls" readOnly={readOnly}>
        <button type="button">View</button>
      </EmbeddedCanvasControls>
    </ReactFlowProvider>,
  );
  return screen.getByRole("group", { name: "Run view controls" });
}

describe("EmbeddedCanvasControls", () => {
  it("renders the menus without a read-only badge by default", () => {
    const controls = renderControls();
    expect(
      within(controls).getByRole("button", { name: "View" }),
    ).toBeInTheDocument();
    expect(within(controls).queryByText("Read only")).toBeNull();
  });

  it("shows the read-only badge when read only", () => {
    const controls = renderControls(true);
    expect(within(controls).getByText("Read only")).toBeInTheDocument();
  });
});

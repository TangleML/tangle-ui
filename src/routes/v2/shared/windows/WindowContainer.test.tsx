import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { WindowContainer } from "./WindowContainer";

const windowsMock = vi.hoisted(() => ({
  getFloatingWindowIds: vi.fn(() => ["canvas-controls", "run-details"]),
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: windowsMock }),
}));

vi.mock("./Window", () => ({
  Window: ({ windowId }: { windowId: string }) => (
    <div data-testid={`window-${windowId}`} />
  ),
}));

afterEach(cleanup);

it("does not render windows excluded from the current surface", () => {
  render(<WindowContainer excludedWindowIds={new Set(["canvas-controls"])} />);

  expect(
    screen.queryByTestId("window-canvas-controls"),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId("window-run-details")).toBeInTheDocument();
});

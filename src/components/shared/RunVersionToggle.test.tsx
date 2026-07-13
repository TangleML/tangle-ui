import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunVersionToggle } from "./RunVersionToggle";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: "/runs/run-1",
  params: { id: "run-1" } as Record<string, string>,
  enabled: true,
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => mocks.enabled,
}));

describe("RunVersionToggle", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.pathname = "/runs/run-1";
    mocks.params = { id: "run-1" };
    mocks.enabled = true;
    localStorage.removeItem("seen-run-v2-welcome");
  });

  afterEach(cleanup);

  it("switches from the V1 run view to V2", () => {
    render(<RunVersionToggle />);

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to V2 run view" }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/runs-v2/run-1" });
  });

  it("switches from V2 to V1 while preserving the subgraph execution", () => {
    mocks.pathname = "/runs-v2/run-1/subgraph-1";
    mocks.params = { id: "run-1", subgraphExecutionId: "subgraph-1" };
    render(<RunVersionToggle />);

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to V1 run view" }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/runs/run-1/subgraph-1",
    });
  });

  it("introduces the version toggle in the V2 run view", async () => {
    mocks.pathname = "/runs-v2/run-1";
    render(<RunVersionToggle showWelcomeSpotlight />);

    expect(
      await screen.findByRole("dialog", {
        name: "Welcome to the new run view",
      }),
    ).toHaveTextContent(
      "You can easily switch between the new and old run views here.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("seen-run-v2-welcome")).toBe("true");
  });

  it("does not render when the V2 experience flag is disabled", () => {
    mocks.enabled = false;
    render(<RunVersionToggle />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

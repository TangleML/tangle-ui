import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { RunViewModeToggle } from "./RunViewModeToggle";

afterEach(cleanup);

it("shows the active run visualization and changes modes", () => {
  const onModeChange = vi.fn();
  render(<RunViewModeToggle mode="graph" onModeChange={onModeChange} />);

  expect(screen.getByRole("button", { name: "Graph" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "Timing" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  fireEvent.click(screen.getByRole("button", { name: "Timing" }));
  expect(onModeChange).toHaveBeenCalledWith("timing");
});

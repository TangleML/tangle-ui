import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RunTimingToolbar } from "./RunTimingToolbar";

afterEach(cleanup);

describe("RunTimingToolbar", () => {
  it("supports task filtering, critical-path filtering, and refresh", () => {
    const onTaskFilterChange = vi.fn();
    const onCriticalPathOnlyChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <RunTimingToolbar
        taskFilter=""
        criticalPathOnly={false}
        refreshing={false}
        onTaskFilterChange={onTaskFilterChange}
        onCriticalPathOnlyChange={onCriticalPathOnlyChange}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search timing tasks" }),
      {
        target: { value: "train" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Critical path only" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onTaskFilterChange).toHaveBeenCalledWith("train");
    expect(onCriticalPathOnlyChange).toHaveBeenCalledWith(true);
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Give feedback/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("announces active filters and refresh progress", () => {
    render(
      <RunTimingToolbar
        taskFilter="train"
        criticalPathOnly
        refreshing
        onTaskFilterChange={vi.fn()}
        onCriticalPathOnlyChange={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Critical path only" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Refreshing" })).toBeDisabled();
  });
});

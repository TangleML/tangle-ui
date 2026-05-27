import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourceFilterBar } from "./DashboardComponentsView";

describe("SourceFilterBar", () => {
  it("toggles component source buttons", () => {
    const onToggle = vi.fn();
    const onEnableAll = vi.fn();

    render(
      <SourceFilterBar
        disabledSources={["library"]}
        onToggle={onToggle}
        onEnableAll={onEnableAll}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Hide User generated source" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Show Library / GitHub source" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Show Library / GitHub source" }),
    );
    expect(onToggle).toHaveBeenCalledWith("library");

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onEnableAll).toHaveBeenCalledTimes(1);
  });
});

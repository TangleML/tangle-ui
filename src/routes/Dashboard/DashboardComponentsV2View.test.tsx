import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SourceFilterBar,
  type SourceFilterOption,
} from "./DashboardComponentsV2View";

const options: SourceFilterOption[] = [
  {
    source: { kind: "standard", label: "Standard", id: "standard" },
    count: 2,
  },
  {
    source: { kind: "registered", label: "GitHub", id: "github-lib" },
    count: 3,
  },
  {
    source: { kind: "user", label: "User", id: "user" },
    count: 1,
  },
];

describe("SourceFilterBar", () => {
  it("toggles source buttons and exposes active state", () => {
    const onToggle = vi.fn();
    const onEnableAll = vi.fn();

    render(
      <SourceFilterBar
        options={options}
        disabledSourceKeys={["registered:github-lib"]}
        onToggle={onToggle}
        onEnableAll={onEnableAll}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Hide Standard source (2 components)",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Show GitHub source (3 components)" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Show GitHub source (3 components)" }),
    );
    expect(onToggle).toHaveBeenCalledWith("registered:github-lib");

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onEnableAll).toHaveBeenCalledTimes(1);
  });
});

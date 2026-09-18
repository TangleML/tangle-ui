import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectColorPicker } from "./ProjectColorPicker";

describe("ProjectColorPicker", () => {
  it("offers every palette colour plus no colour at all", () => {
    render(<ProjectColorPicker value={undefined} onChange={vi.fn()} />);

    for (const name of [
      "No colour",
      "Violet",
      "Blue",
      "Cyan",
      "Emerald",
      "Amber",
      "Rose",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks the chosen colour as pressed and the others not", () => {
    render(<ProjectColorPicker value="amber" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Amber" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Violet" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "No colour" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("treats no colour as the selection when nothing is chosen", () => {
    render(<ProjectColorPicker value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "No colour" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reports the colour the user picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ProjectColorPicker value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Rose" }));

    expect(onChange).toHaveBeenCalledWith("rose");
  });

  it("reports nothing when the user clears the colour", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ProjectColorPicker value="rose" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "No colour" }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("does not submit a form it is rendered inside", () => {
    render(<ProjectColorPicker value={undefined} onChange={vi.fn()} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
    }
  });
});

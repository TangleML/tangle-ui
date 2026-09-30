import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewProjectCard } from "./NewProjectCard";

describe("NewProjectCard", () => {
  it("reads as a single button called New project", () => {
    render(<NewProjectCard />);

    expect(
      screen.getByRole("button", { name: "New project" }),
    ).toBeInTheDocument();
  });

  it("does not submit a form it happens to sit inside", () => {
    render(<NewProjectCard />);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("hands clicks to whatever opens the dialog", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<NewProjectCard onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "New project" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

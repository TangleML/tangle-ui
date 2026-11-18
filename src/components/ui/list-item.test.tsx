import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListItem } from "./list-item";

describe("ListItem", () => {
  it("describes its status to screen readers, including a spinner's", () => {
    render(
      <ul>
        <ListItem
          title="Churn model"
          flair={{ kind: "spinner", label: "Working" }}
          onOpen={vi.fn()}
        />
      </ul>,
    );

    expect(
      screen.getByRole("button", { name: "Churn model" }),
    ).toHaveAccessibleDescription("Working");
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("says whether a group it heads is open, and keeps a menu with its actions", () => {
    render(
      <ListItem
        as="div"
        icon="Folder"
        title="Forecasting"
        expanded={false}
        onOpen={vi.fn()}
        actions={[{ icon: "Pencil", label: "Rename", onClick: vi.fn() }]}
        menu={<button type="button">More</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Forecasting" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });
});

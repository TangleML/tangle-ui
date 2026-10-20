import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaginationControls } from "./PaginationControls";

function renderControls(
  overrides: Partial<ComponentProps<typeof PaginationControls>> = {},
) {
  const props = {
    currentPage: 1,
    hasNextPage: true,
    hasPreviousPage: false,
    onNextPage: vi.fn(),
    onPreviousPage: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  render(<PaginationControls {...props} />);
  return props;
}

afterEach(cleanup);

describe("PaginationControls", () => {
  it.each([0, 1])(
    "hides controls for a known total of %i pages",
    (totalPages) => {
      renderControls({ totalPages });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("preserves known totals and navigation callbacks", () => {
    const props = renderControls({
      currentPage: 2,
      totalPages: 3,
      hasPreviousPage: true,
    });

    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(props.onReset).toHaveBeenCalledOnce();
    expect(props.onPreviousPage).toHaveBeenCalledOnce();
    expect(props.onNextPage).toHaveBeenCalledOnce();
  });

  it("disables every navigation action while a page is pending", () => {
    const props = renderControls({
      currentPage: 2,
      hasPreviousPage: true,
      disabled: true,
    });

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(props.onReset).not.toHaveBeenCalled();
    expect(props.onPreviousPage).not.toHaveBeenCalled();
    expect(props.onNextPage).not.toHaveBeenCalled();
  });

  it("shows the first page's Next button without a total", () => {
    const props = renderControls();

    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onNextPage).toHaveBeenCalledOnce();
  });

  it("keeps backward navigation on the last page without a total", () => {
    renderControls({
      currentPage: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });

    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("hides controls when there is no previous or next page and no total", () => {
    renderControls({ hasNextPage: false });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

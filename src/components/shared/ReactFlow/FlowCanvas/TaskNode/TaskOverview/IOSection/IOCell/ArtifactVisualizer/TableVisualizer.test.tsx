import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TableVisualizer from "./TableVisualizer";
import type { ArtifactTableData } from "./utils";

const makeData = (rowCount: number, hasMore = false): ArtifactTableData => ({
  columns: [{ name: "Name" }, { name: "Score" }],
  rows: Array.from({ length: rowCount }, (_, i) => [
    `row-${i}`,
    String(i * 10),
  ]),
  hasMore,
});

describe("TableVisualizer", () => {
  it("renders headers and all rows it was given", () => {
    const data = makeData(3);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("row-0")).toBeInTheDocument();
    expect(screen.getByText("row-2")).toBeInTheDocument();
  });

  it("says 'Showing all N rows' when hasMore is false", () => {
    const data = makeData(5);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.getByText("Showing all 5 rows")).toBeInTheDocument();
  });

  it("says 'Showing first N rows' when hasMore is true and load handlers are provided", () => {
    const data = makeData(100, true);
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        onLoadMore={() => {}}
        onLoadAll={() => {}}
      />,
    );

    expect(screen.getByText("Showing first 100 rows")).toBeInTheDocument();
  });

  it("flags the preview limit when hasMore is true but no onLoadMore is provided", () => {
    const data = makeData(10000, true);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(
      screen.getByText("Showing first 10000 rows (preview limit reached)"),
    ).toBeInTheDocument();
  });

  it("renders Load more / Load all buttons when handlers are provided and fires them on click", async () => {
    const onLoadMore = vi.fn();
    const onLoadAll = vi.fn();
    const data = makeData(100, true);

    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        onLoadMore={onLoadMore}
        onLoadAll={onLoadAll}
      />,
    );

    const loadMore = screen.getByRole("button", { name: "Load more" });
    const loadAll = screen.getByRole("button", { name: "Load all" });

    await userEvent.click(loadMore);
    expect(onLoadMore).toHaveBeenCalledOnce();

    await userEvent.click(loadAll);
    expect(onLoadAll).toHaveBeenCalledOnce();
  });

  it("does not render Load more / Load all when no handlers are provided", () => {
    const data = makeData(100, true);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load all" })).toBeNull();
  });

  it("uses the Table container as the scroll element with sticky header cells", () => {
    const data = makeData(3);
    const { container } = render(
      <TableVisualizer data={data} isFullscreen={false} />,
    );

    const tableContainer = container.querySelector(
      '[data-slot="table-container"]',
    );
    expect(tableContainer).toHaveClass("overflow-auto", "flex-1");

    const tableHeads = container.querySelectorAll('[data-slot="table-head"]');
    expect(tableHeads.length).toBeGreaterThan(0);
    tableHeads.forEach((th) => {
      expect(th).toHaveClass("sticky", "top-0");
    });
  });

  it("renders the row-count footer outside the Table scroll container", () => {
    const data = makeData(3);
    const { container } = render(
      <TableVisualizer data={data} isFullscreen={false} />,
    );

    const tableContainer = container.querySelector(
      '[data-slot="table-container"]',
    );
    const footer = screen.getByText("Showing all 3 rows");

    expect(tableContainer?.contains(footer)).toBe(false);
  });
});

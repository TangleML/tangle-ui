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
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={3}
        columnCount={2}
      />,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("row-0")).toBeInTheDocument();
    expect(screen.getByText("row-2")).toBeInTheDocument();
  });

  it("says 'Showing all N rows' when hasMore is false", () => {
    const data = makeData(5);
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={5}
        columnCount={2}
      />,
    );

    expect(screen.getByText("Showing all 5 rows")).toBeInTheDocument();
  });

  it("says 'Showing first X of Y rows' when more remain", () => {
    const data = makeData(100, true);
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={2500000}
        columnCount={2}
        onLoadMore={() => {}}
        onLoadAll={() => {}}
      />,
    );

    expect(
      screen.getByText("Showing first 100 of 2,500,000 rows"),
    ).toBeInTheDocument();
  });

  it("renders Load more / Load max buttons when handlers are provided and fires them on click", async () => {
    const onLoadMore = vi.fn();
    const onLoadAll = vi.fn();
    const data = makeData(100, true);

    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={2500000}
        columnCount={2}
        onLoadMore={onLoadMore}
        onLoadAll={onLoadAll}
      />,
    );

    const loadMore = screen.getByRole("button", { name: "Load more" });
    const loadAll = screen.getByRole("button", { name: "Load max" });

    await userEvent.click(loadMore);
    expect(onLoadMore).toHaveBeenCalledOnce();

    await userEvent.click(loadAll);
    expect(onLoadAll).toHaveBeenCalledOnce();
  });

  it("does not render Load more / Load max when no handlers are provided", () => {
    const data = makeData(100, true);
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={100}
        columnCount={2}
      />,
    );

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load max" })).toBeNull();
  });

  it("fetches the full dataset and saves it with the correct filename when the limit is reached", async () => {
    const blob = new Blob(["full,data"], { type: "text/csv" });
    const getBlob = vi.fn(async () => blob);
    // jsdom has no object-URL implementation, so install mocks to observe.
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    // The generated anchor's click would otherwise navigate jsdom.
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const data = makeData(1000, true);

    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={2500000}
        columnCount={2}
        downloadFull={{ getBlob, filename: "data.parquet" }}
      />,
    );

    expect(screen.getByText(/Preview limit reached/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load max" })).toBeNull();

    // The bytes are fetched only on click, then saved same-origin so our
    // filename sticks (a cross-origin <a download> would be ignored).
    await userEvent.click(
      screen.getByRole("button", { name: /Download full dataset/ }),
    );

    expect(getBlob).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    anchorClick.mockRestore();
  });

  it("does not prompt to download while more rows can still be loaded", () => {
    const data = makeData(100, true);
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={2500000}
        columnCount={2}
        onLoadMore={() => {}}
        onLoadAll={() => {}}
        downloadFull={{
          getBlob: async () => new Blob(),
          filename: "data.parquet",
        }}
      />,
    );

    expect(screen.queryByText(/Preview limit reached/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Download full dataset/ }),
    ).toBeNull();
  });

  it("uses the Table container as the scroll element with sticky header cells", () => {
    const data = makeData(3);
    const { container } = render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={3}
        columnCount={2}
      />,
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
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={3}
        columnCount={2}
      />,
    );

    const tableContainer = container.querySelector(
      '[data-slot="table-container"]',
    );
    const footer = screen.getByText("Showing all 3 rows");

    expect(tableContainer?.contains(footer)).toBe(false);
  });

  it("renders row/column stats with thousands separators", () => {
    const data = makeData(3);
    const totalRows = 1234567;
    const columnCount = 12;
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={totalRows}
        columnCount={columnCount}
      />,
    );

    const expected = `${totalRows.toLocaleString()} rows · ${columnCount.toLocaleString()} columns`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders a Download schema button and fires the handler on click", async () => {
    const onDownloadSchema = vi.fn();
    const data = makeData(3);
    render(
      <TableVisualizer
        data={data}
        isFullscreen={false}
        totalRows={3}
        columnCount={2}
        onDownloadSchema={onDownloadSchema}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Download schema/ }),
    );
    expect(onDownloadSchema).toHaveBeenCalledOnce();
  });
});

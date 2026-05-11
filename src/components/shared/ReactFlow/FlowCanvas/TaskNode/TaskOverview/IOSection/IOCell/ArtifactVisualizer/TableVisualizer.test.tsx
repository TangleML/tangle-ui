import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TableVisualizer from "./TableVisualizer";
import type { ArtifactTableData } from "./utils";

const makeData = (rowCount: number): ArtifactTableData => ({
  headers: ["Name", "Score"],
  rows: Array.from({ length: rowCount }, (_, i) => [
    `row-${i}`,
    String(i * 10),
  ]),
});

describe("TableVisualizer", () => {
  it("renders headers and rows", () => {
    const data = makeData(3);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("row-0")).toBeInTheDocument();
    expect(screen.getByText("row-2")).toBeInTheDocument();
  });

  it("limits rows to DEFAULT_PREVIEW_ROWS (10) when not fullscreen", () => {
    const data = makeData(20);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.getByText("row-9")).toBeInTheDocument();
    expect(screen.queryByText("row-10")).not.toBeInTheDocument();
    expect(screen.getByText("Showing first 10 rows")).toBeInTheDocument();
  });

  it("shows up to MAX_PREVIEW_ROWS (30) when fullscreen", () => {
    const data = makeData(35);
    render(<TableVisualizer data={data} isFullscreen={true} />);

    expect(screen.getByText("row-29")).toBeInTheDocument();
    expect(screen.queryByText("row-30")).not.toBeInTheDocument();
    expect(screen.getByText("Showing first 30 rows")).toBeInTheDocument();
  });

  it("shows 'Showing all N rows' when all rows fit", () => {
    const data = makeData(5);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.getByText("Showing all 5 rows")).toBeInTheDocument();
  });

  it("renders 'See all' link when remoteLink is provided and rows are truncated", () => {
    const data = makeData(20);
    render(
      <TableVisualizer
        data={data}
        remoteLink="https://storage.example.com/file.csv"
        isFullscreen={false}
      />,
    );

    const link = screen.getByRole("link", { name: "See all" });
    expect(link).toHaveAttribute(
      "href",
      "https://storage.example.com/file.csv",
    );
  });

  it("does not render 'See all' link when remoteLink is not provided", () => {
    const data = makeData(20);
    render(<TableVisualizer data={data} isFullscreen={false} />);

    expect(screen.queryByText("See all")).not.toBeInTheDocument();
  });

  it("does not render 'See all' link when all rows are shown", () => {
    const data = makeData(3);
    render(
      <TableVisualizer
        data={data}
        remoteLink="https://storage.example.com/file.csv"
        isFullscreen={false}
      />,
    );

    expect(screen.queryByText("See all")).not.toBeInTheDocument();
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

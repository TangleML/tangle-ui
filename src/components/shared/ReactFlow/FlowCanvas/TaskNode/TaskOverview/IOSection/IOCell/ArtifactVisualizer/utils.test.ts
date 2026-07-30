import { describe, expect, it } from "vitest";

import {
  getPreviewRowLimit,
  MAX_PREVIEW_CELLS,
  MAX_PREVIEW_ROWS,
  parseCsv,
} from "./utils";

const buildCsv = (dataRows: number) => {
  const lines = ["id,name"];
  for (let i = 0; i < dataRows; i++) lines.push(`${i},row-${i}`);
  return lines.join("\n");
};

// buildCsv emits two columns, so its per-shape row limit is the absolute cap.
const CSV_ROW_LIMIT = getPreviewRowLimit(2);

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const parsed = parseCsv("Name,Age\nAlice,30\nBob,25");

    expect(parsed.columns.map((c) => c.name)).toEqual(["Name", "Age"]);
    expect(parsed.rows).toEqual([
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
    expect(parsed.totalRows).toBe(2);
    expect(parsed.truncated).toBe(false);
  });

  it("auto-detects a tab delimiter", () => {
    const parsed = parseCsv("Name\tAge\nAlice\t30");

    expect(parsed.columns.map((c) => c.name)).toEqual(["Name", "Age"]);
    expect(parsed.rows).toEqual([["Alice", "30"]]);
  });

  it("returns empty result for blank input", () => {
    expect(parseCsv("")).toEqual({
      columns: [],
      rows: [],
      truncated: false,
      totalRows: 0,
    });
  });

  it("counts every row but only retains the preview rows when truncated", () => {
    const total = CSV_ROW_LIMIT + 2500;
    const parsed = parseCsv(buildCsv(total));

    expect(parsed.totalRows).toBe(total);
    expect(parsed.rows).toHaveLength(CSV_ROW_LIMIT);
    expect(parsed.truncated).toBe(true);
    // The retained rows are the first ones, in order.
    expect(parsed.rows[0]).toEqual(["0", "row-0"]);
    expect(parsed.rows[CSV_ROW_LIMIT - 1]).toEqual([
      String(CSV_ROW_LIMIT - 1),
      `row-${CSV_ROW_LIMIT - 1}`,
    ]);
  });

  it("is not truncated when the row count exactly hits the preview limit", () => {
    const parsed = parseCsv(buildCsv(CSV_ROW_LIMIT));

    expect(parsed.totalRows).toBe(CSV_ROW_LIMIT);
    expect(parsed.rows).toHaveLength(CSV_ROW_LIMIT);
    expect(parsed.truncated).toBe(false);
  });

  it("caps preview rows by the cell budget for wide tables", () => {
    const columnCount = 100;
    const rowLimit = getPreviewRowLimit(columnCount);
    const header = Array.from({ length: columnCount }, (_, i) => `c${i}`).join(
      ",",
    );
    const dataRow = Array.from({ length: columnCount }, () => "x").join(",");
    const lines = [header];
    for (let i = 0; i < rowLimit + 50; i++) lines.push(dataRow);
    const parsed = parseCsv(lines.join("\n"));

    // A wide table is bounded well below the absolute row cap.
    expect(rowLimit).toBeLessThan(MAX_PREVIEW_ROWS);
    expect(rowLimit).toBe(MAX_PREVIEW_CELLS / columnCount);
    expect(parsed.rows).toHaveLength(rowLimit);
    expect(parsed.truncated).toBe(true);
  });

  it("counts rows correctly when a field contains a quoted newline", () => {
    const parsed = parseCsv('a,b\n"line1\nline2",x\ny,z');

    expect(parsed.totalRows).toBe(2);
    expect(parsed.rows).toEqual([
      ["line1\nline2", "x"],
      ["y", "z"],
    ]);
  });
});

describe("getPreviewRowLimit", () => {
  it("bounds narrow tables by the absolute row cap", () => {
    expect(getPreviewRowLimit(1)).toBe(MAX_PREVIEW_ROWS);
    // 50_000 / 5 = 10_000, which equals the cap.
    expect(getPreviewRowLimit(5)).toBe(MAX_PREVIEW_ROWS);
  });

  it("bounds wide tables by the cell budget", () => {
    expect(getPreviewRowLimit(50)).toBe(MAX_PREVIEW_CELLS / 50);
    expect(getPreviewRowLimit(100)).toBe(MAX_PREVIEW_CELLS / 100);
  });

  it("always allows at least one row, even past the budget", () => {
    expect(getPreviewRowLimit(MAX_PREVIEW_CELLS * 2)).toBe(1);
  });

  it("treats a zero column count as a single column", () => {
    expect(getPreviewRowLimit(0)).toBe(MAX_PREVIEW_ROWS);
  });
});

import Papa from "papaparse";

export type ArtifactColumn = {
  name: string;
  type?: string;
  nullable?: boolean;
};

export type ArtifactTableData = {
  columns: ArtifactColumn[];
  rows: string[][];
  hasMore: boolean;
};

export type ParsedArtifact = {
  columns: ArtifactColumn[];
  rows: string[][];
  truncated: boolean;
  totalRows: number;
};

export const MAX_VISUALIZABLE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const MAX_PREVIEW_CELLS = 50_000;
export const MAX_PREVIEW_ROWS = 10_000;

export function getPreviewRowLimit(columnCount: number): number {
  const byCellBudget = Math.floor(MAX_PREVIEW_CELLS / Math.max(1, columnCount));
  return Math.min(MAX_PREVIEW_ROWS, Math.max(1, byCellBudget));
}

export function parseCsv(text: string, delimiter?: string): ParsedArtifact {
  let headers: string[] | undefined;
  let rowLimit = MAX_PREVIEW_ROWS;
  const rows: string[][] = [];
  let totalRows = 0;

  Papa.parse<string[]>(text, {
    delimiter,
    header: false,
    skipEmptyLines: true,
    step: (result) => {
      const row = result.data;
      if (headers === undefined) {
        headers = row;
        rowLimit = getPreviewRowLimit(headers.length);
        return;
      }
      totalRows++;
      if (rows.length < rowLimit) rows.push(row);
    },
  });

  if (headers === undefined) {
    return { columns: [], rows: [], truncated: false, totalRows: 0 };
  }

  const columns = headers.map((name) => ({ name }));
  return { columns, rows, truncated: totalRows > rowLimit, totalRows };
}

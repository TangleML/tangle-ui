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
};

export const MAX_PREVIEW_ROWS = 1000;

const HEADER_ROW = 1;
const TRUNCATION_LOOKAHEAD = 1;

export function parseCsv(text: string, delimiter?: string): ParsedArtifact {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    header: false,
    preview: MAX_PREVIEW_ROWS + HEADER_ROW + TRUNCATION_LOOKAHEAD,
    skipEmptyLines: true,
  });

  if (result.data.length === 0) {
    return { columns: [], rows: [], truncated: false };
  }

  const [headers, ...rows] = result.data;
  const columns = headers.map((name) => ({ name }));
  const truncated = rows.length > MAX_PREVIEW_ROWS;
  return { columns, rows: rows.slice(0, MAX_PREVIEW_ROWS), truncated };
}

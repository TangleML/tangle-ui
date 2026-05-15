import Papa from "papaparse";

export type ArtifactTableData = {
  headers: string[];
  rows: string[][];
  hasMore: boolean;
};

export type ParsedArtifact = {
  headers: string[];
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
    return { headers: [], rows: [], truncated: false };
  }

  const [headers, ...rows] = result.data;
  const truncated = rows.length > MAX_PREVIEW_ROWS;
  return { headers, rows: rows.slice(0, MAX_PREVIEW_ROWS), truncated };
}

import Papa from "papaparse";

export type ArtifactTableData = { headers: string[]; rows: string[][] };

export const DEFAULT_PREVIEW_ROWS = 10;
export const MAX_PREVIEW_ROWS = 30;

export function parseCsv(text: string, delimiter?: string): ArtifactTableData {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    header: false,
    preview: MAX_PREVIEW_ROWS + 1,
    skipEmptyLines: true,
  });

  if (result.data.length === 0) return { headers: [], rows: [] };

  const [headers, ...rows] = result.data;
  return { headers, rows };
}

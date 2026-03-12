export type ArtifactTableData = { headers: string[]; rows: string[][] };

export const DEFAULT_PREVIEW_ROWS = 10;
export const MAX_PREVIEW_ROWS = 30;

export function parseCsvPreview(
  text: string,
  delimiter: string,
): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const split = (line: string) =>
    line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());

  const headers = split(lines[0]);
  const rows = lines.slice(1, MAX_PREVIEW_ROWS + 2).map(split);
  return { headers, rows };
}

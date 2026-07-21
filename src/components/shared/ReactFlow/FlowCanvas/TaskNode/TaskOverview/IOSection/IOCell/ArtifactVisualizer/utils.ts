import { type FileMetaData, type SchemaElement, toJson } from "hyparquet";
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

/**
 * Parquet previews are capped at the top N rows. Because parquet is read via
 * range requests we only ever fetch these rows, regardless of file size.
 */
export const PARQUET_PREVIEW_ROWS = 100;

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

/** Format a leaf schema element's type, preferring the logical type when present. */
export function formatParquetType(el: SchemaElement): string {
  if (el.logical_type) return el.logical_type.type;
  return el.type ?? "";
}

/** Build the column list for a parquet preview from its schema and first row. */
export function buildColumns(
  schema: SchemaElement[],
  firstRow: Record<string, unknown>,
): ArtifactColumn[] {
  const schemaByName = new Map(
    schema.filter((el) => el.type !== undefined).map((el) => [el.name, el]),
  );
  return Object.keys(firstRow).map((name) => {
    const el = schemaByName.get(name);
    return {
      name,
      type: el ? formatParquetType(el) : undefined,
      nullable: el?.repetition_type === "OPTIONAL",
    };
  });
}

/** Leaf (typed) schema elements — the actual data columns, excluding root/group nodes. */
function leafElements(schema: SchemaElement[]): SchemaElement[] {
  return schema.filter((el) => el.type !== undefined);
}

/** Number of top-level columns, falling back to the leaf count for flat schemas. */
export function countColumns(metadata: FileMetaData): number {
  return (
    metadata.schema[0]?.num_children ?? leafElements(metadata.schema).length
  );
}

/**
 * Build a clean, human-readable JSON representation of a parquet file's schema,
 * suitable for download. bigint values are sanitized via hyparquet's toJson.
 */
export function buildSchemaJson(metadata: FileMetaData): unknown {
  const columns = leafElements(metadata.schema).map((el) => ({
    name: el.name,
    type: formatParquetType(el),
    logical_type: el.logical_type,
    repetition_type: el.repetition_type,
    nullable: el.repetition_type === "OPTIONAL",
  }));

  return toJson({
    num_rows: metadata.num_rows,
    num_columns: countColumns(metadata),
    columns,
  });
}

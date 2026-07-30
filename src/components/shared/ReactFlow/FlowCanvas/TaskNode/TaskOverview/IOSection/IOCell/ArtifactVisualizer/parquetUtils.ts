import {
  type AsyncBuffer,
  asyncBufferFromUrl,
  byteLengthFromUrl,
  cachedAsyncBuffer,
  type FileMetaData,
  parquetMetadata,
  parquetMetadataAsync,
  parquetReadObjects,
  type SchemaElement,
  toJson,
} from "hyparquet";

import { ArtifactFetchError } from "@/services/executionService";

import {
  fetchArtifactForHyparquet,
  fetchArtifactOrThrow,
} from "./useArtifactFetch";
import { type ArtifactColumn, MAX_VISUALIZABLE_SIZE_BYTES } from "./utils";

export const PARQUET_PREVIEW_ROWS = 100;
export const PARQUET_LOAD_MORE_ROWS = 100;

type ParquetSource = AsyncBuffer | ArrayBuffer;

export interface OpenedParquet {
  source: ParquetSource;
  metadata: FileMetaData;
}

export async function openParquet(signedUrl: string): Promise<OpenedParquet> {
  try {
    const byteLength = await byteLengthFromUrl(
      signedUrl,
      undefined,
      fetchArtifactForHyparquet,
    );
    const source = cachedAsyncBuffer(
      await asyncBufferFromUrl({
        url: signedUrl,
        byteLength,
        fetch: fetchArtifactForHyparquet,
      }),
    );
    const metadata = await parquetMetadataAsync(source);
    return { source, metadata };
  } catch (error) {
    if (error instanceof ArtifactFetchError) throw error;

    const response = await fetchArtifactOrThrow(signedUrl);
    const contentLengthHeader = response.headers.get("Content-Length");
    const contentLength = contentLengthHeader
      ? Number(contentLengthHeader)
      : NaN;
    if (
      !Number.isFinite(contentLength) ||
      contentLength > MAX_VISUALIZABLE_SIZE_BYTES
    ) {
      throw new ArtifactFetchError(
        413,
        "Payload Too Large",
        "This parquet file is too large to preview without range-request support.",
      );
    }

    const source = await response.arrayBuffer();
    return { source, metadata: parquetMetadata(source) };
  }
}

export async function readParquetRows(
  { source, metadata }: OpenedParquet,
  columns: ArtifactColumn[],
  rowStart: number,
  rowEnd: number,
): Promise<string[][]> {
  const objects = await parquetReadObjects({
    file: source,
    metadata,
    rowStart,
    rowEnd,
  });
  return objects.map((obj) =>
    columns.map((col) => obj[col.name]),
  ) as string[][];
}

export async function readParquetPreview(
  opened: OpenedParquet,
  previewRows: number,
): Promise<{ columns: ArtifactColumn[]; rows: string[][] }> {
  const objects = await parquetReadObjects({
    file: opened.source,
    metadata: opened.metadata,
    rowEnd: previewRows,
  });
  if (objects.length === 0) return { columns: [], rows: [] };

  const columns = buildColumns(opened.metadata.schema, objects[0]);
  const rows = objects.map((obj) =>
    columns.map((col) => obj[col.name]),
  ) as string[][];
  return { columns, rows };
}

function formatParquetType(el: SchemaElement): string {
  if (el.logical_type) return el.logical_type.type;
  return el.type ?? "";
}

function buildColumns(
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

function leafElements(schema: SchemaElement[]): SchemaElement[] {
  return schema.filter((el) => el.type !== undefined);
}

export function countColumns(metadata: FileMetaData): number {
  return (
    metadata.schema[0]?.num_children ?? leafElements(metadata.schema).length
  );
}

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

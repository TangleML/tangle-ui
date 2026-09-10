import {
  type AsyncBuffer,
  asyncBufferFromUrl,
  cachedAsyncBuffer,
  type FileMetaData,
  parquetMetadata,
  parquetMetadataAsync,
  parquetReadObjects,
  type SchemaElement,
  toJson,
} from "hyparquet";

import { ArtifactFetchError } from "@/services/executionService";

import { fetchArtifactOrThrow } from "./useArtifactFetch";
import {
  type ArtifactCell,
  type ArtifactColumn,
  MAX_VISUALIZABLE_SIZE_BYTES,
} from "./utils";

export const PARQUET_PREVIEW_ROWS = 100;
export const PARQUET_LOAD_MORE_ROWS = 100;

type ParquetSource = AsyncBuffer | ArrayBuffer;

export interface OpenedParquet {
  source: ParquetSource;
  metadata: FileMetaData;
}

export async function openParquet(
  signedUrl: string,
  byteLength?: number,
): Promise<OpenedParquet> {
  try {
    const source = cachedAsyncBuffer(
      await asyncBufferFromUrl({
        url: signedUrl,
        byteLength:
          typeof byteLength === "number" && byteLength > 0
            ? byteLength
            : await byteLengthFromRangedGet(signedUrl),
        fetch: fetchArtifactOrThrow,
      }),
    );
    const metadata = await parquetMetadataAsync(source);
    return { source, metadata };
  } catch (error) {
    if (error instanceof ArtifactFetchError) throw error;
    return openByFullDownload(signedUrl);
  }
}

/**
 * Signed object-store URLs reject HEAD — the method is part of the signature —
 * and a bucket's CORS policy need not allow it either, so a blocked HEAD
 * surfaces as an opaque network error rather than a 403 the caller could fall
 * back from. A ranged GET is signed and needs no preflight, but reading the
 * total size back requires the bucket to expose `Content-Range`; where it does
 * not, this throws and the caller downloads the whole object instead.
 */
async function byteLengthFromRangedGet(url: string): Promise<number> {
  const controller = new AbortController();
  const response = await fetchArtifactOrThrow(url, {
    headers: { Range: "bytes=0-0" },
    signal: controller.signal,
  });
  const totalSize = response.headers
    .get("Content-Range")
    ?.match(/\/(\d+)$/)?.[1];
  controller.abort();

  if (response.status !== 206 || !totalSize) {
    throw new Error("Artifact host does not support range requests.");
  }
  return Number(totalSize);
}

async function openByFullDownload(signedUrl: string): Promise<OpenedParquet> {
  const response = await fetchArtifactOrThrow(signedUrl);
  const contentLength = Number(response.headers.get("Content-Length"));
  if (!contentLength || contentLength > MAX_VISUALIZABLE_SIZE_BYTES) {
    throw new ArtifactFetchError(
      413,
      "Payload Too Large",
      "This parquet file is too large to preview without range-request support.",
    );
  }

  const source = await response.arrayBuffer();
  return { source, metadata: parquetMetadata(source) };
}

export async function readParquetRows(
  { source, metadata }: OpenedParquet,
  columns: ArtifactColumn[],
  rowStart: number,
  rowEnd: number,
): Promise<ArtifactCell[][]> {
  const objects = await parquetReadObjects({
    file: source,
    metadata,
    rowStart,
    rowEnd,
  });
  return objects.map((obj) => columns.map((col) => obj[col.name]));
}

export async function readParquetPreview(
  opened: OpenedParquet,
  previewRows: number,
): Promise<{ columns: ArtifactColumn[]; rows: ArtifactCell[][] }> {
  const objects = await parquetReadObjects({
    file: opened.source,
    metadata: opened.metadata,
    rowEnd: previewRows,
  });
  if (objects.length === 0) return { columns: [], rows: [] };

  const columns = buildColumns(opened.metadata.schema, objects[0]);
  const rows = objects.map((obj) => columns.map((col) => obj[col.name]));
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

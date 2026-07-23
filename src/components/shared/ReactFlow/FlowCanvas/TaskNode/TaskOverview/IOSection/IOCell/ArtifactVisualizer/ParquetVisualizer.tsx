import { useSuspenseQuery } from "@tanstack/react-query";
import {
  asyncBufferFromUrl,
  byteLengthFromUrl,
  cachedAsyncBuffer,
  parquetMetadataAsync,
  parquetReadObjects,
} from "hyparquet";

import { Paragraph } from "@/components/ui/typography";
import { ArtifactFetchError } from "@/services/executionService";
import { HOURS } from "@/utils/constants";
import { downloadStringAsFile } from "@/utils/URL";

import TableVisualizer from "./TableVisualizer";
import { useRowCap } from "./useRowCap";
import {
  buildColumns,
  buildSchemaJson,
  countColumns,
  PARQUET_PREVIEW_ROWS,
  type ParsedArtifact,
} from "./utils";

interface ParquetVisualizerProps {
  signedUrl: string;
  isFullscreen: boolean;
}

interface ParquetPreview {
  parsed: ParsedArtifact;
  totalRows: number;
  columnCount: number;
  schemaJson: unknown;
}

/**
 * Fetch that throws ArtifactFetchError on failure so callers (and the
 * ArtifactVisualizer error fallback) can branch on status — e.g. the 404
 * "Artifact unavailable" path. Range requests return 206, which is `ok`.
 */
const fetchOrThrow: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new ArtifactFetchError(
      response.status,
      response.statusText,
      "Failed to fetch artifact.",
    );
  }
  return response;
};

const ParquetVisualizer = ({
  signedUrl,
  isFullscreen,
}: ParquetVisualizerProps) => {
  const { data: preview } = useSuspenseQuery<ParquetPreview>({
    queryKey: ["artifact-parquet", signedUrl],
    queryFn: async () => {
      // Range-request-backed buffer: reads only the footer + the pages needed
      // for the preview, so file size no longer bounds what we can open.
      const byteLength = await byteLengthFromUrl(
        signedUrl,
        undefined,
        fetchOrThrow,
      );
      const file = cachedAsyncBuffer(
        await asyncBufferFromUrl({
          url: signedUrl,
          byteLength,
          fetch: fetchOrThrow,
        }),
      );
      const metadata = await parquetMetadataAsync(file);

      const objects = await parquetReadObjects({
        file,
        metadata,
        rowEnd: PARQUET_PREVIEW_ROWS + 1,
      });

      const totalRows = Number(metadata.num_rows);
      const columnCount = countColumns(metadata);
      const schemaJson = buildSchemaJson(metadata);

      if (objects.length === 0) {
        return {
          parsed: { columns: [], rows: [], truncated: false },
          totalRows,
          columnCount,
          schemaJson,
        };
      }

      const columns = buildColumns(metadata.schema, objects[0]);
      const truncated = objects.length > PARQUET_PREVIEW_ROWS;
      const rows = objects
        .slice(0, PARQUET_PREVIEW_ROWS)
        .map((obj) => columns.map((col) => obj[col.name])) as string[][];

      return {
        parsed: { columns, rows, truncated },
        totalRows,
        columnCount,
        schemaJson,
      };
    },
    staleTime: 24 * HOURS,
    retry: false,
  });

  const { data, onLoadMore, onLoadAll } = useRowCap(preview.parsed);

  if (data.columns.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  const handleDownloadSchema = () => {
    downloadStringAsFile(
      JSON.stringify(preview.schemaJson, null, 2),
      "schema.json",
      "application/json",
    );
  };

  return (
    <TableVisualizer
      data={data}
      isFullscreen={isFullscreen}
      onLoadMore={onLoadMore}
      onLoadAll={onLoadAll}
      totalRows={preview.totalRows}
      columnCount={preview.columnCount}
      onDownloadSchema={handleDownloadSchema}
    />
  );
};

export default ParquetVisualizer;

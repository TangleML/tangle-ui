import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { HOURS } from "@/utils/constants";
import { downloadStringAsFile } from "@/utils/URL";

import {
  buildSchemaJson,
  countColumns,
  type OpenedParquet,
  openParquet,
  PARQUET_LOAD_MORE_ROWS,
  PARQUET_PREVIEW_ROWS,
  readParquetPreview,
  readParquetRows,
} from "./parquetUtils";
import TableVisualizer from "./TableVisualizer";
import { fetchArtifactOrThrow } from "./useArtifactFetch";
import {
  type ArtifactCell,
  type ArtifactColumn,
  getPreviewRowLimit,
} from "./utils";

interface ParquetVisualizerProps {
  signedUrl: string;
  isFullscreen: boolean;
  byteLength?: number;
}

interface ParquetBase {
  opened: OpenedParquet;
  columns: ArtifactColumn[];
  initialRows: ArtifactCell[][];
  totalRows: number;
  columnCount: number;
  schemaJson: unknown;
}

const ParquetVisualizer = ({
  signedUrl,
  isFullscreen,
  byteLength,
}: ParquetVisualizerProps) => {
  const { data: base } = useSuspenseQuery<ParquetBase>({
    queryKey: ["artifact-parquet", signedUrl, byteLength],
    queryFn: async () => {
      const opened = await openParquet(signedUrl, byteLength);
      const columnCount = countColumns(opened.metadata);
      const { columns, rows } = await readParquetPreview(
        opened,
        Math.min(PARQUET_PREVIEW_ROWS, getPreviewRowLimit(columnCount)),
      );

      return {
        opened,
        columns,
        initialRows: rows,
        totalRows: Number(opened.metadata.num_rows),
        columnCount,
        schemaJson: buildSchemaJson(opened.metadata),
      };
    },
    staleTime: 24 * HOURS,
    retry: false,
  });

  if (base.columns.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <ParquetTable
      key={signedUrl}
      base={base}
      isFullscreen={isFullscreen}
      signedUrl={signedUrl}
    />
  );
};

export default ParquetVisualizer;

interface ParquetTableProps {
  base: ParquetBase;
  isFullscreen: boolean;
  signedUrl: string;
}

/**
 * Renders the loaded rows and pulls in more on demand. Kept as a child keyed by
 * the signed URL so its row state resets cleanly when a different artifact loads.
 */
const ParquetTable = ({ base, isFullscreen, signedUrl }: ParquetTableProps) => {
  const [rows, setRows] = useState(base.initialRows);
  const [isLoading, setIsLoading] = useState(false);
  const notify = useToastNotification();

  const loadedCount = rows.length;
  const renderCap = Math.min(
    base.totalRows,
    getPreviewRowLimit(base.columnCount),
  );
  const hasMore = loadedCount < base.totalRows;
  const canLoadMore = loadedCount < renderCap;

  const loadUpTo = async (target: number) => {
    if (isLoading || target <= loadedCount) return;
    setIsLoading(true);
    try {
      const more = await readParquetRows(
        base.opened,
        base.columns,
        loadedCount,
        target,
      );
      setRows((prev) => [...prev, ...more]);
    } catch (error) {
      console.error("Failed to load more parquet rows:", error);
      notify("Failed to load more rows. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSchema = () => {
    downloadStringAsFile(
      JSON.stringify(base.schemaJson, null, 2),
      "schema.json",
      "application/json",
    );
  };

  return (
    <TableVisualizer
      data={{ columns: base.columns, rows, hasMore }}
      isFullscreen={isFullscreen}
      onLoadMore={
        canLoadMore
          ? () =>
              loadUpTo(
                Math.min(loadedCount + PARQUET_LOAD_MORE_ROWS, renderCap),
              )
          : undefined
      }
      onLoadAll={canLoadMore ? () => loadUpTo(renderCap) : undefined}
      isLoading={isLoading}
      totalRows={base.totalRows}
      columnCount={base.columnCount}
      onDownloadSchema={handleDownloadSchema}
      downloadFull={{
        filename: "data.parquet",
        getBlob: async () => (await fetchArtifactOrThrow(signedUrl)).blob(),
      }}
    />
  );
};

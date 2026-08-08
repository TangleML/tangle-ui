import { useSuspenseQuery } from "@tanstack/react-query";

import { Paragraph } from "@/components/ui/typography";
import { HOURS } from "@/utils/constants";
import { downloadStringAsFile } from "@/utils/URL";

import {
  buildSchemaJson,
  countColumns,
  openParquet,
  PARQUET_PREVIEW_ROWS,
  readParquetPreview,
} from "./parquetUtils";
import TableVisualizer from "./TableVisualizer";
import { type ArtifactColumn } from "./utils";

interface ParquetVisualizerProps {
  signedUrl: string;
  isFullscreen: boolean;
}

interface ParquetBase {
  columns: ArtifactColumn[];
  rows: string[][];
  totalRows: number;
  columnCount: number;
  schemaJson: unknown;
}

const ParquetVisualizer = ({
  signedUrl,
  isFullscreen,
}: ParquetVisualizerProps) => {
  const { data: base } = useSuspenseQuery<ParquetBase>({
    queryKey: ["artifact-parquet", signedUrl],
    queryFn: async () => {
      const opened = await openParquet(signedUrl);
      const { columns, rows } = await readParquetPreview(
        opened,
        PARQUET_PREVIEW_ROWS,
      );

      return {
        columns,
        rows,
        totalRows: Number(opened.metadata.num_rows),
        columnCount: countColumns(opened.metadata),
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

  const handleDownloadSchema = () => {
    downloadStringAsFile(
      JSON.stringify(base.schemaJson, null, 2),
      "schema.json",
      "application/json",
    );
  };

  return (
    <TableVisualizer
      data={{
        columns: base.columns,
        rows: base.rows,
        hasMore: base.rows.length < base.totalRows,
      }}
      isFullscreen={isFullscreen}
      totalRows={base.totalRows}
      columnCount={base.columnCount}
      onDownloadSchema={handleDownloadSchema}
    />
  );
};

export default ParquetVisualizer;

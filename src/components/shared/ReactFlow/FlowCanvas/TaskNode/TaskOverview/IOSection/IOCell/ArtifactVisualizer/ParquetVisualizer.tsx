import {
  parquetMetadata,
  parquetReadObjects,
  type SchemaElement,
} from "hyparquet";

import { Paragraph } from "@/components/ui/typography";

import TableVisualizer from "./TableVisualizer";
import { useArtifactFetch } from "./useArtifactFetch";
import { useRowCap } from "./useRowCap";
import {
  type ArtifactColumn,
  MAX_PREVIEW_ROWS,
  type ParsedArtifact,
} from "./utils";

interface ParquetVisualizerProps {
  signedUrl: string;
  isFullscreen: boolean;
}

const ParquetVisualizer = ({
  signedUrl,
  isFullscreen,
}: ParquetVisualizerProps) => {
  const parsed = useArtifactFetch<ParsedArtifact>(
    "parquet",
    signedUrl,
    async (response) => {
      const arrayBuffer = await response.arrayBuffer();
      const metadata = parquetMetadata(arrayBuffer);
      const objects = await parquetReadObjects({
        file: arrayBuffer,
        rowEnd: MAX_PREVIEW_ROWS + 1,
      });

      if (objects.length === 0) {
        return { columns: [], rows: [], truncated: false };
      }

      const columns = buildColumns(metadata.schema, objects[0]);
      const truncated = objects.length > MAX_PREVIEW_ROWS;
      const rows = objects
        .slice(0, MAX_PREVIEW_ROWS)
        .map((obj) => columns.map((col) => obj[col.name])) as string[][];

      return { columns, rows, truncated };
    },
  );

  const { data, onLoadMore, onLoadAll } = useRowCap(parsed);

  if (data.columns.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <TableVisualizer
      data={data}
      isFullscreen={isFullscreen}
      onLoadMore={onLoadMore}
      onLoadAll={onLoadAll}
    />
  );
};

export default ParquetVisualizer;

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

function formatParquetType(el: SchemaElement): string {
  if (el.logical_type) return el.logical_type.type;
  return el.type ?? "";
}

import { parquetReadObjects } from "hyparquet";

import { Paragraph } from "@/components/ui/typography";

import TableVisualizer from "./TableVisualizer";
import { useArtifactFetch } from "./useArtifactFetch";
import { useRowCap } from "./useRowCap";
import { MAX_PREVIEW_ROWS, type ParsedArtifact } from "./utils";

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
      const objects = await parquetReadObjects({
        file: arrayBuffer,
        rowEnd: MAX_PREVIEW_ROWS + 1,
      });

      if (objects.length === 0) {
        return { headers: [], rows: [], truncated: false };
      }

      const headers = Object.keys(objects[0]);
      const truncated = objects.length > MAX_PREVIEW_ROWS;
      const rows = objects
        .slice(0, MAX_PREVIEW_ROWS)
        .map((obj) => headers.map((h) => obj[String(h)]));

      return { headers, rows, truncated };
    },
  );

  const { data, onLoadMore, onLoadAll } = useRowCap(parsed);

  if (parsed.headers.length === 0) {
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

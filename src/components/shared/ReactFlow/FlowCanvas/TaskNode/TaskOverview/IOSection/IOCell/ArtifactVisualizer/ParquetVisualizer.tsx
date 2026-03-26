import { parquetReadObjects } from "hyparquet";

import { Paragraph } from "@/components/ui/typography";

import TableVisualizer from "./TableVisualizer";
import { useArtifactFetch } from "./useArtifactFetch";
import { MAX_PREVIEW_ROWS } from "./utils";

interface ParquetVisualizerProps {
  signedUrl: string;
  isFullscreen: boolean;
}

const ParquetVisualizer = ({
  signedUrl,
  isFullscreen,
}: ParquetVisualizerProps) => {
  const data = useArtifactFetch("parquet", signedUrl, async (response) => {
    const arrayBuffer = await response.arrayBuffer();
    const objects = await parquetReadObjects({
      file: arrayBuffer,
      rowEnd: MAX_PREVIEW_ROWS + 1,
    });

    if (objects.length === 0) return { headers: [], rows: [] };
    const headers = Object.keys(objects[0]);
    const rows = objects.map((obj) => headers.map((h) => obj[String(h)]));

    return { headers, rows };
  });

  if (data.headers.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <TableVisualizer
      data={data}
      remoteLink={signedUrl}
      isFullscreen={isFullscreen}
    />
  );
};

export default ParquetVisualizer;

import { useQuery } from "@tanstack/react-query";
import { parquetReadObjects } from "hyparquet";

import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import TableVisualizer from "./TableVisualizer";
import { MAX_PREVIEW_ROWS } from "./utils";

interface ParquetVisualizerProps {
  signedUrl: string;
  isFullscreen: boolean;
}

const ParquetVisualizer = ({
  signedUrl,
  isFullscreen,
}: ParquetVisualizerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-parquet", signedUrl],
    queryFn: async () => {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const objects = await parquetReadObjects({
        file: arrayBuffer,
        rowEnd: MAX_PREVIEW_ROWS + 1,
      });

      if (objects.length === 0) return { headers: [], rows: [] };
      const headers = Object.keys(objects[0]);
      const rows = objects.map((obj) => headers.map((h) => obj[String(h)]));

      return { headers, rows };
    },
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
    retry: false,
  });

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <Paragraph tone="critical" size="xs">
        {error?.message}
      </Paragraph>
    );
  }

  if (!data || data.headers.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <TableVisualizer
      data={data}
      signedUrl={signedUrl}
      isFullscreen={isFullscreen}
    />
  );
};

export default ParquetVisualizer;

import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import TableVisualizer from "./TableVisualizer";
import { parseCsvPreview } from "./utils";

interface CsvVisualizerProps {
  signedUrl: string;
  delimiter: string;
  isFullscreen: boolean;
}

const CsvVisualizer = ({
  signedUrl,
  delimiter,
  isFullscreen,
}: CsvVisualizerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-csv", signedUrl, delimiter],
    queryFn: async () => {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      const text = await response.text();
      return parseCsvPreview(text, delimiter);
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

export default CsvVisualizer;

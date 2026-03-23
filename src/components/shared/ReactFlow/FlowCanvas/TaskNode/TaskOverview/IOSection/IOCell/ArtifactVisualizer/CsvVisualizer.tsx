import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import TableVisualizer from "./TableVisualizer";
import { parseCsvPreview } from "./utils";

type CsvVisualizerProps = {
  delimiter: string;
  isFullscreen: boolean;
} & (
  | { value: string; signedUrl?: never }
  | { value?: never; signedUrl: string }
);

const CsvVisualizer = ({
  delimiter,
  isFullscreen,
  value,
  signedUrl,
}: CsvVisualizerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-csv", signedUrl, delimiter],
    queryFn: async () => {
      if (!signedUrl) return null;

      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      const text = await response.text();
      return parseCsvPreview(text, delimiter);
    },
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
    retry: false,
    enabled: !!signedUrl,
  });

  const parsed = value ? parseCsvPreview(value, delimiter) : data;

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <Paragraph tone="critical" size="xs">
        {error?.message}
      </Paragraph>
    );
  }

  if (!parsed || parsed.headers.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <TableVisualizer
      data={parsed}
      signedUrl={signedUrl}
      isFullscreen={isFullscreen}
    />
  );
};

export default CsvVisualizer;

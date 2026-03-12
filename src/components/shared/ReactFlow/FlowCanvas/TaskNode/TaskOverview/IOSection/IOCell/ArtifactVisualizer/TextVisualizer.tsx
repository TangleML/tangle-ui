import { useQuery } from "@tanstack/react-query";

import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

type TextVisualizerProps =
  | {
      value: string;
      signedUrl?: never;
    }
  | {
      value?: never;
      signedUrl: string;
    };

const TextVisualizer = ({ value, signedUrl }: TextVisualizerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-text", signedUrl],
    queryFn: async () => {
      if (!signedUrl) return null;

      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      const text = await response.text();
      return text;
    },
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
    retry: false,
    enabled: !!signedUrl,
  });

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <Paragraph tone="critical" size="xs">
        {error?.message}
      </Paragraph>
    );
  }

  if (!value && (!data || data.length === 0)) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <BlockStack className="flex-1 min-h-0 min-w-0 overflow-y-auto wrap-anywhere">
      <Text size="sm">{value ?? data}</Text>
    </BlockStack>
  );
};

export default TextVisualizer;

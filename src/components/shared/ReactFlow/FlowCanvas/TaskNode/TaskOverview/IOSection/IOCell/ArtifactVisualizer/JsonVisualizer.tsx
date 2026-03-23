import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import IOCodeViewer from "../IOCodeViewer";

type JsonVisualizerProps = {
  name: string;
} & (
  | { value: string; signedUrl?: never }
  | { value?: never; signedUrl: string }
);

const JsonVisualizer = ({ name, value, signedUrl }: JsonVisualizerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-json", signedUrl],
    queryFn: async () => {
      if (!signedUrl) return null;

      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      return response.text();
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

  const content = value ?? data;
  if (!content) return null;

  return <IOCodeViewer title={name} value={content} />;
};

export default JsonVisualizer;

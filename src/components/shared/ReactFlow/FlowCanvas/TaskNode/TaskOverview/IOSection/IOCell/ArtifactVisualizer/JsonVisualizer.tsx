import { useQuery } from "@tanstack/react-query";

import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import IOCodeViewer from "../IOCodeViewer";

interface JsonVisualizerProps {
  signedUrl: string;
  name: string;
}

const JsonVisualizer = ({ signedUrl, name }: JsonVisualizerProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-json", signedUrl],
    queryFn: async () => {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      return response.text();
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

  if (!data) return null;

  return <IOCodeViewer title={name} value={data} />;
};

export default JsonVisualizer;

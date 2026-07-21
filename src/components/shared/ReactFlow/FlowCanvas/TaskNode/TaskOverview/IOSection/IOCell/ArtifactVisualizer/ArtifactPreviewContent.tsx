import { useSuspenseQuery } from "@tanstack/react-query";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/providers/BackendProvider";
import { getArtifactSignedUrl } from "@/services/executionService";
import { HOURS } from "@/utils/constants";

import { CsvVisualizerRemote, CsvVisualizerValue } from "./CsvVisualizer";
import ImageVisualizer from "./ImageVisualizer";
import { JsonVisualizerRemote, JsonVisualizerValue } from "./JsonVisualizer";
import ParquetVisualizer from "./ParquetVisualizer";
import { TextVisualizerRemote, TextVisualizerValue } from "./TextVisualizer";

interface InlineContentProps {
  type: string;
  name: string;
  value: string;
  isFullscreen: boolean;
}

export const InlineContent = ({
  type,
  name,
  value,
  isFullscreen,
}: InlineContentProps) => {
  switch (type) {
    case "csv":
    case "tsv":
      return <CsvVisualizerValue value={value} isFullscreen={isFullscreen} />;
    case "jsonobject":
    case "jsonarray":
      return <JsonVisualizerValue value={value} name={name} />;
    case "text":
    default:
      return <TextVisualizerValue value={value} isFullscreen={isFullscreen} />;
  }
};

interface PreviewContentProps {
  artifactId: string;
  type: string;
  name: string;
  isFullscreen: boolean;
}

export const PreviewContent = ({
  artifactId,
  type,
  name,
  isFullscreen,
}: PreviewContentProps) => {
  const { backendUrl } = useBackend();

  const { data } = useSuspenseQuery({
    queryKey: ["artifact-signed-url", artifactId],
    queryFn: () => getArtifactSignedUrl(artifactId, backendUrl),
    staleTime: 24 * HOURS,
    retry: false,
  });

  const signedUrl = data?.signed_url;
  if (!signedUrl) return null;

  switch (type) {
    case "text":
      return (
        <TextVisualizerRemote
          signedUrl={signedUrl}
          isFullscreen={isFullscreen}
        />
      );
    case "image":
      return <ImageVisualizer src={signedUrl} name={name} />;
    case "csv":
    case "tsv":
      return (
        <CsvVisualizerRemote
          signedUrl={signedUrl}
          isFullscreen={isFullscreen}
        />
      );
    case "apacheparquet":
      return (
        <ParquetVisualizer signedUrl={signedUrl} isFullscreen={isFullscreen} />
      );
    case "jsonobject":
    case "jsonarray":
      return <JsonVisualizerRemote signedUrl={signedUrl} name={name} />;
    default:
      return null;
  }
};

const SKELETON_ROWS = 6;

export const PreviewSkeleton = () => (
  <BlockStack gap="3" className="p-2">
    <InlineStack gap="4">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={`h-${i}`} size="lg" />
      ))}
    </InlineStack>
    {Array.from({ length: SKELETON_ROWS }, (_, i) => (
      <InlineStack key={`r-${i}`} gap="4">
        <Skeleton size="sm" />
        <Skeleton size="lg" />
        <Skeleton size="sm" />
      </InlineStack>
    ))}
  </BlockStack>
);

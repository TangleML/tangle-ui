import { useSuspenseQuery } from "@tanstack/react-query";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/providers/BackendProvider";
import { getArtifactSignedUrl } from "@/services/executionService";
import { HOURS } from "@/utils/constants";
import { parseHttpUrl } from "@/utils/URL";

import { CsvVisualizerRemote, CsvVisualizerValue } from "./CsvVisualizer";
import ImageVisualizer from "./ImageVisualizer";
import { JsonVisualizerRemote, JsonVisualizerValue } from "./JsonVisualizer";
import ParquetVisualizer from "./ParquetVisualizer";
import { TextVisualizerRemote, TextVisualizerValue } from "./TextVisualizer";
import { UrlVisualizerRemote, UrlVisualizerValue } from "./UrlVisualizer";

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
      return (
        <CsvVisualizerValue
          value={value}
          type={type}
          isFullscreen={isFullscreen}
        />
      );
    case "jsonobject":
    case "jsonarray":
      return (
        <JsonVisualizerValue
          value={value}
          name={name}
          isFullscreen={isFullscreen}
        />
      );
    case "url":
      return <UrlVisualizerValue value={value} />;
    case "text":
    default:
      return parseHttpUrl(value) ? (
        <UrlVisualizerValue value={value} />
      ) : (
        <TextVisualizerValue value={value} isFullscreen={isFullscreen} />
      );
  }
};

interface PreviewContentProps {
  artifactId: string;
  type: string;
  name: string;
  isFullscreen: boolean;
  byteLength?: number;
}

export const PreviewContent = ({
  artifactId,
  type,
  name,
  isFullscreen,
  byteLength,
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
    case "url":
      return <UrlVisualizerRemote signedUrl={signedUrl} />;
    case "image":
      return <ImageVisualizer src={signedUrl} name={name} />;
    case "csv":
    case "tsv":
      return (
        <CsvVisualizerRemote
          signedUrl={signedUrl}
          type={type}
          isFullscreen={isFullscreen}
        />
      );
    case "apacheparquet":
      return (
        <ParquetVisualizer
          signedUrl={signedUrl}
          isFullscreen={isFullscreen}
          byteLength={byteLength}
        />
      );
    case "jsonobject":
    case "jsonarray":
      return (
        <JsonVisualizerRemote
          signedUrl={signedUrl}
          name={name}
          isFullscreen={isFullscreen}
        />
      );
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

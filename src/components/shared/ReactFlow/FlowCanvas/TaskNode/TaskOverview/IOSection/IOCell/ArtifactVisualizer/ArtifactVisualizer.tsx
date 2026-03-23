import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { ArtifactNodeResponse } from "@/api/types.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { getArtifactSignedUrl } from "@/services/executionService";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import ArtifactURI from "../ArtifactURI";
import CsvVisualizer from "./CsvVisualizer";
import ImageVisualizer from "./ImageVisualizer";
import JsonVisualizer from "./JsonVisualizer";
import ParquetVisualizer from "./ParquetVisualizer";
import TextVisualizer from "./TextVisualizer";

const VISUALIZABLE_TYPES = new Set([
  "text",
  "image",
  "jsonobject",
  "jsonarray",
  "csv",
  "tsv",
  "apacheparquet",
]);

type ArtifactVisualizerProps = {
  artifact: ArtifactNodeResponse;
  name: string;
  type: string;
  value?: string;
};

const ArtifactVisualizer = ({
  artifact,
  name,
  type,
  value,
}: ArtifactVisualizerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const normalizedType = type?.toLowerCase().replace(/\s/g, "") ?? "text";

  const handleOpenChange = (open: boolean) => {
    if (!open) setIsFullscreen(false);
  };

  if (!VISUALIZABLE_TYPES.has(normalizedType)) return null;

  const artifactData = artifact.artifact_data;
  const isJson =
    normalizedType === "jsonobject" || normalizedType === "jsonarray";

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {value ? (
          <Button variant="ghost" size="xs">
            <Icon
              name="Maximize2"
              size="xs"
              className="text-muted-foreground"
            />
          </Button>
        ) : (
          <Button variant="ghost" size="xs">
            <Icon name="Eye" />
            Preview
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          "flex flex-col",
          isFullscreen
            ? "max-w-none! max-h-screen! w-screen h-screen rounded-none"
            : "max-w-5xl w-full max-h-[90vh]",
        )}
      >
        {!isJson && (
          <Button
            variant="ghost"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="absolute top-3 right-10 rounded-md"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            size="xs"
          >
            <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} size="xs" />
          </Button>
        )}
        <DialogHeader>
          <InlineStack gap="4" blockAlign="end">
            <DialogTitle>{name}</DialogTitle>
            {type && (
              <Text size="xs" tone="subdued" weight="light" className="-ml-2">
                {type}
              </Text>
            )}

            {artifactData?.uri && (
              <ArtifactURI uri={artifactData.uri} isDir={artifactData.is_dir} />
            )}
          </InlineStack>

          <DialogDescription className="hidden">
            Artifact visualization for {name}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1 min-h-0">
          {value ? (
            <InlineContent
              name={name}
              value={value}
              type={normalizedType}
              isFullscreen={isFullscreen}
            />
          ) : (
            <PreviewContent
              name={name}
              artifactId={artifact.id}
              type={normalizedType}
              isFullscreen={isFullscreen}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface InlineContentProps {
  type: string;
  name: string;
  value: string;
  isFullscreen: boolean;
}

const InlineContent = ({
  type,
  name,
  value,
  isFullscreen,
}: InlineContentProps) => {
  switch (type) {
    case "csv":
      return (
        <CsvVisualizer
          value={value}
          delimiter=","
          isFullscreen={isFullscreen}
        />
      );
    case "tsv":
      return (
        <CsvVisualizer
          value={value}
          delimiter={"\t"}
          isFullscreen={isFullscreen}
        />
      );
    case "jsonobject":
    case "jsonarray":
      return <JsonVisualizer value={value} name={name} />;
    case "text":
    default:
      return <TextVisualizer value={value} />;
  }
};

interface PreviewContentProps {
  artifactId: string;
  type: string;
  name: string;
  isFullscreen: boolean;
}

const PreviewContent = ({
  artifactId,
  type,
  name,
  isFullscreen,
}: PreviewContentProps) => {
  const { backendUrl } = useBackend();

  const { data, isLoading, error } = useQuery({
    queryKey: ["artifact-signed-url", artifactId],
    queryFn: () => getArtifactSignedUrl(artifactId, backendUrl),
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
    retry: false,
  });

  if (isLoading) return <Spinner />;

  if (error) {
    return (
      <Paragraph tone="critical" size="xs">
        Could not load preview: {(error as Error).message}
      </Paragraph>
    );
  }

  const signedUrl = data?.signed_url;
  if (!signedUrl) return null;

  switch (type) {
    case "text":
      return <TextVisualizer signedUrl={signedUrl} />;
    case "image":
      return <ImageVisualizer src={signedUrl} name={name} />;
    case "csv":
      return (
        <CsvVisualizer
          signedUrl={signedUrl}
          delimiter=","
          isFullscreen={isFullscreen}
        />
      );
    case "tsv":
      return (
        <CsvVisualizer
          signedUrl={signedUrl}
          delimiter={"\t"}
          isFullscreen={isFullscreen}
        />
      );
    case "apacheparquet":
      return (
        <ParquetVisualizer signedUrl={signedUrl} isFullscreen={isFullscreen} />
      );
    case "jsonobject":
    case "jsonarray":
      return <JsonVisualizer signedUrl={signedUrl} name={name} />;
    default:
      return null;
  }
};

export default ArtifactVisualizer;

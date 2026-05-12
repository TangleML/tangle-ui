import { type MouseEvent, useState } from "react";

import type { ArtifactNodeResponse } from "@/api/types.gen";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { ArtifactFetchError } from "@/services/executionService";
import { copyToClipboard } from "@/utils/string";
import { getArtifactPreviewUrl } from "@/utils/URL";

import {
  InlineContent,
  isVisualizableType,
  normalizeRawType,
  PreviewContent,
  PreviewSkeleton,
  resolveArtifactType,
} from "./ArtifactPreviewContent";
import { ArtifactPreviewError } from "./ArtifactPreviewError";
import { ArtifactPreviewHeader } from "./ArtifactPreviewHeader";

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
  const { track } = useAnalytics();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rawType = normalizeRawType(type);
  const normalizedType = resolveArtifactType(rawType);

  const handleOpenChange = (open: boolean) => {
    if (!open) setIsFullscreen(false);
    if (open)
      track("pipeline_run.task.artifact_preview.impression", {
        artifact_type: normalizedType,
      });
  };

  const notify = useToastNotification();

  const handleFullScreenClick = (e: MouseEvent) => {
    if ((e.metaKey || e.ctrlKey) && previewUrl) {
      track("pipeline_run.artifact_preview.open_in_new_tab", {
        artifact_type: normalizedType,
      });
      window.open(previewUrl, "_blank");
      return;
    }
    setIsFullscreen((prev) => !prev);
  };

  const handleShareClick = () => {
    if (!previewUrl) return;
    copyToClipboard(previewUrl);
    notify("Link copied to clipboard", "success");
  };

  if (!isVisualizableType(normalizedType) && !value) return null;

  const artifactData = artifact.artifact_data;
  const isJson =
    normalizedType === "jsonobject" || normalizedType === "jsonarray";
  const previewUrl = !value
    ? getArtifactPreviewUrl(artifact.id, type, name)
    : null;

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
            onClick={handleFullScreenClick}
            className="absolute top-3 right-10 rounded-md"
            aria-label={
              isFullscreen
                ? "Exit fullscreen"
                : "Enter fullscreen (cmd/ctrl+click to open in new tab)"
            }
            size="xs"
          >
            <Icon name={isFullscreen ? "Minimize2" : "Maximize2"} size="xs" />
          </Button>
        )}
        <DialogHeader>
          <ArtifactPreviewHeader
            name={name}
            type={type}
            artifactUri={artifactData?.uri}
            isDir={artifactData?.is_dir}
            shareUrl={previewUrl}
            onShareClick={handleShareClick}
          />

          <DialogDescription className="hidden">
            Artifact visualization for {name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {value ? (
            <InlineContent
              name={name}
              value={value}
              type={normalizedType}
              isFullscreen={isFullscreen}
            />
          ) : (
            <SuspenseWrapper
              fallback={<PreviewSkeleton />}
              errorFallback={({ error }) => {
                if (
                  error instanceof ArtifactFetchError &&
                  error.status === 404 &&
                  import.meta.env.VITE_ARTIFACT_RETENTION_DAYS
                ) {
                  return (
                    <ArtifactPreviewError
                      title="Artifact unavailable"
                      preamble="This artifact could not be found."
                      variant="warning"
                    />
                  );
                }

                const statusDetail =
                  error instanceof ArtifactFetchError
                    ? ` (${error.status}${error.statusText ? ` ${error.statusText}` : ""})`
                    : "";
                return (
                  <ArtifactPreviewError
                    title="Failed to load artifact"
                    preamble={`An unexpected error occurred${statusDetail}.`}
                  />
                );
              }}
            >
              <PreviewContent
                name={name}
                artifactId={artifact.id}
                type={normalizedType}
                isFullscreen={isFullscreen}
              />
            </SuspenseWrapper>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArtifactVisualizer;

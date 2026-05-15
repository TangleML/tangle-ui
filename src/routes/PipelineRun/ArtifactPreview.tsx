import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  inferTypeFromUri,
  isVisualizableType,
  normalizeRawType,
  PreviewContent,
  PreviewSkeleton,
  resolveArtifactType,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewContent";
import { ArtifactPreviewError } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewError";
import { ArtifactPreviewHeader } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewHeader";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import {
  ArtifactFetchError,
  getArtifactInfo,
} from "@/services/executionService";
import { HOURS } from "@/utils/constants";
import { copyToClipboard } from "@/utils/string";
import { getArtifactPreviewUrl } from "@/utils/URL";

type ArtifactPreviewSearch = { type?: string; name?: string };

const ArtifactPreviewPage = () => {
  const { artifactId } = useParams({ strict: false }) as { artifactId: string };
  const search = useSearch({ strict: false }) as ArtifactPreviewSearch;

  return (
    <SuspenseWrapper
      fallback={<PreviewSkeleton />}
      errorFallback={ArtifactPreviewErrorFallback}
    >
      <ArtifactPreviewBody artifactId={artifactId} search={search} />
    </SuspenseWrapper>
  );
};

const ArtifactPreviewErrorFallback = ({ error }: { error: unknown }) => {
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
};

const ArtifactPreviewBody = ({
  artifactId,
  search,
}: {
  artifactId: string;
  search: ArtifactPreviewSearch;
}) => {
  const { backendUrl } = useBackend();
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const { data: artifactInfo } = useSuspenseQuery({
    queryKey: ["artifact-info", artifactId],
    queryFn: () => getArtifactInfo(artifactId, backendUrl),
    staleTime: 24 * HOURS,
    retry: false,
  });

  const artifactData = artifactInfo.artifact_data;
  const name = search.name ?? artifactId;
  const rawType = search.type
    ? normalizeRawType(search.type)
    : (inferTypeFromUri(artifactData?.uri) ?? "text");
  const normalizedType = resolveArtifactType(rawType);
  const supportedType = isVisualizableType(normalizedType);
  const previewUrl = getArtifactPreviewUrl(
    artifactId,
    search.type,
    search.name,
  );

  useEffect(() => {
    track("pipeline_run.artifact_preview_page.impression", {
      artifact_type: normalizedType,
      supported_type: supportedType,
    });
  }, [artifactId, normalizedType, supportedType, track]);

  const handleShareClick = () => {
    copyToClipboard(previewUrl);
    notify("Link copied to clipboard", "success");
  };

  if (!supportedType) {
    return (
      <Paragraph tone="subdued" size="sm">
        Unsupported artifact type: {normalizedType}
      </Paragraph>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <ArtifactPreviewHeader
        name={name}
        type={search.type}
        artifactUri={artifactData?.uri}
        isDir={artifactData?.is_dir}
        shareUrl={previewUrl}
        onShareClick={handleShareClick}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <PreviewContent
          name={name}
          artifactId={artifactId}
          type={normalizedType}
          isFullscreen={true}
        />
      </div>
    </div>
  );
};

export default ArtifactPreviewPage;

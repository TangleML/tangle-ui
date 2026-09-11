import type { ArtifactNodeResponse } from "@/api/types.gen";
import {
  PreviewContent,
  PreviewSkeleton,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewContent";
import {
  isVisualizableType,
  normalizeRawType,
  resolveArtifactType,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/artifactType";
import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { artifactDiffLanguage } from "@/routes/v2/pages/CompareView/utils/artifactTextDiff";

import { ArtifactTextDiff } from "./ArtifactTextDiff";
import { RunTag } from "./RunTag";

interface ArtifactComparisonSide {
  run: "a" | "b";
  label: string;
  artifact: ArtifactNodeResponse | undefined;
  type: string | undefined;
}

function PaneHeader({
  run,
  label,
  type,
}: Pick<ArtifactComparisonSide, "run" | "label" | "type">) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      wrap="nowrap"
      className="min-w-0 flex-1"
    >
      <RunTag run={run} label={label} />
      <Text as="span" size="xs" tone="subdued" className="truncate">
        {type ?? "unknown"}
      </Text>
    </InlineStack>
  );
}

function ComparisonPane({
  run,
  label,
  artifact,
  type,
}: ArtifactComparisonSide) {
  const normalizedType = resolveArtifactType(
    normalizeRawType(type ?? undefined),
  );

  return (
    <BlockStack
      align="stretch"
      gap="2"
      className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border p-2"
    >
      <PaneHeader run={run} label={label} type={type} />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {!artifact ? (
          <Text as="span" size="sm" tone="subdued">
            Not produced in run {label}.
          </Text>
        ) : !isVisualizableType(normalizedType) ? (
          <Text as="span" size="sm" tone="subdued">
            This artifact type cannot be previewed.
          </Text>
        ) : (
          <SuspenseWrapper
            fallback={<PreviewSkeleton />}
            errorFallback={() => (
              <Text as="span" size="sm" tone="subdued">
                Failed to load artifact.
              </Text>
            )}
          >
            <PreviewContent
              name={`${label}:${artifact.id}`}
              artifactId={artifact.id}
              type={normalizedType}
              isFullscreen
              byteLength={artifact.artifact_data?.total_size}
            />
          </SuspenseWrapper>
        )}
      </div>
    </BlockStack>
  );
}

interface ArtifactComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  labelA: string;
  labelB: string;
  artifactA: ArtifactNodeResponse | undefined;
  artifactB: ArtifactNodeResponse | undefined;
  typeA: string | undefined;
  typeB: string | undefined;
}

export function ArtifactComparisonDialog({
  open,
  onOpenChange,
  name,
  labelA,
  labelB,
  artifactA,
  artifactB,
  typeA,
  typeB,
}: ArtifactComparisonDialogProps) {
  const diffLanguage = artifactDiffLanguage(
    resolveArtifactType(normalizeRawType(typeA ?? undefined)),
    resolveArtifactType(normalizeRawType(typeB ?? undefined)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[95vw] flex-col sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            <Text as="span" className="font-mono">
              {name}
            </Text>{" "}
            · artifact comparison
          </DialogTitle>
        </DialogHeader>
        {artifactA && artifactB && diffLanguage ? (
          <BlockStack
            align="stretch"
            gap="2"
            className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border p-2"
          >
            <InlineStack gap="3" blockAlign="center" wrap="nowrap">
              <PaneHeader run="a" label={labelA} type={typeA} />
              <PaneHeader run="b" label={labelB} type={typeB} />
            </InlineStack>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <ArtifactTextDiff
                artifactIdA={artifactA.id}
                artifactIdB={artifactB.id}
                labelA={labelA}
                labelB={labelB}
                language={diffLanguage}
              />
            </div>
          </BlockStack>
        ) : (
          <InlineStack
            gap="3"
            blockAlign="stretch"
            wrap="nowrap"
            className="min-h-0 w-full flex-1"
          >
            <ComparisonPane
              run="a"
              label={labelA}
              artifact={artifactA}
              type={typeA}
            />
            <ComparisonPane
              run="b"
              label={labelB}
              artifact={artifactB}
              type={typeB}
            />
          </InlineStack>
        )}
      </DialogContent>
    </Dialog>
  );
}

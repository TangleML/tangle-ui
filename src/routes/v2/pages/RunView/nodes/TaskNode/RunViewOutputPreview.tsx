import type { ArtifactNodeResponse } from "@/api/types.gen";
import ArtifactVisualizer from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactVisualizer";
import type { TypeSpecType } from "@/models/componentSpec";

const MAX_VISUALIZABLE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

interface RunViewOutputPreviewProps {
  artifact: ArtifactNodeResponse | null | undefined;
  name: string;
  type?: TypeSpecType;
}

/**
 * Renders the artifact Preview trigger for a single task output in RunView.
 * Returns null when there is no previewable artifact, mirroring the
 * eligibility rules used by IOCell in the task Artifacts panel.
 */
export const RunViewOutputPreview = ({
  artifact,
  name,
  type,
}: RunViewOutputPreviewProps) => {
  if (!artifact) return null;

  const artifactData = artifact.artifact_data;
  const inlineValue = artifactData?.value;
  const hasInlineValue = canShowInlineValue(inlineValue);
  const hasDetails = Boolean(artifactData?.uri || hasInlineValue);
  const isTooLargeToVisualize =
    !hasInlineValue &&
    !!artifactData?.total_size &&
    artifactData.total_size > MAX_VISUALIZABLE_SIZE_BYTES;

  if (!hasDetails || isTooLargeToVisualize) return null;

  const artifactType =
    type?.toString() ??
    artifact.type_name ??
    (artifactData?.is_dir ? "Directory" : "Any");

  return (
    <ArtifactVisualizer
      triggerVariant="outline"
      artifact={artifact}
      name={name}
      type={artifactType}
      value={hasInlineValue ? inlineValue : undefined}
    />
  );
};

const canShowInlineValue = (
  value: string | null | undefined,
): value is string => !!value && String(value).trim() !== "";

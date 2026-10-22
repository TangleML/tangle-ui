import type { ComponentProps } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTarget } from "./types";

function PipelineWorkareaEditor({
  target,
  ...props
}: Omit<ComponentProps<typeof EmbeddedPipelineEditor>, "pipelineRef"> & {
  target: WorkareaTarget;
}) {
  const { backendUrl, ready, configured } = useBackend();
  const storage = usePipelineStorage();
  const { key, value } = parseIdentity(target.identity);
  if (!ready) return <LoadingScreen message="Loading pipeline..." />;
  if (!configured)
    return <p role="alert">Configure a backend to open pipelines.</p>;
  let pipelineRef: EditorPipelineRef;
  try {
    if (key === "remote") {
      pipelineRef = { source: "remote", backendUrl, pipelineId: value };
    } else if (key === "draft") {
      pipelineRef = storage.getRemoteDraftRef(value, backendUrl);
    } else {
      throw new Error(
        "This pipeline is unavailable. Open a saved pipeline from the project.",
      );
    }
  } catch (error) {
    return (
      <Paragraph role="alert">
        {error instanceof Error
          ? error.message
          : "This pipeline is unavailable. Close this tab and reopen the pipeline."}
      </Paragraph>
    );
  }
  return <EmbeddedPipelineEditor pipelineRef={pipelineRef} {...props} />;
}

registerWorkareaKind({
  type: "pipeline",
  icon: "GitBranch",
  keepMounted: true,
  resolveTitle: (target) => parseIdentity(target.identity).value,
  render: (tab, hostProps) => (
    <PipelineWorkareaEditor
      target={tab.target}
      isActive={hostProps.isActive}
      projectId={hostProps.projectId}
      onStoreReady={(store) => hostProps.registerTabStore(tab.id, store)}
      onStoreClosed={() => hostProps.unregisterTabStore(tab.id)}
      sessionId={hostProps.sessionId}
      environmentId={hostProps.tabEnvironmentId(tab.id)}
      onEnvironmentReady={(environmentId) =>
        hostProps.registerTabEnvironment(tab.id, environmentId)
      }
      onEnvironmentClosed={() => hostProps.unregisterTabEnvironment(tab.id)}
      onBridgeReady={(bridge) =>
        hostProps.registerTabBridge(tab.id, "pipeline", bridge)
      }
      onBridgeClosed={() => hostProps.unregisterTabBridge(tab.id)}
    />
  ),
});

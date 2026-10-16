import type { ComponentProps } from "react";

import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { findById } from "@/services/pipelineStorage/pipelineRegistry";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";
import { pipelineFileTarget } from "@/services/projects/pipelineResource";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTarget } from "./types";

function PipelineWorkareaEditor({
  target,
  title,
  ...props
}: Omit<ComponentProps<typeof EmbeddedPipelineEditor>, "pipelineRef"> & {
  target: WorkareaTarget;
  title: string;
}) {
  const { backendUrl, ready, configured } = useBackend();
  const storage = usePipelineStorage();
  const project = useTangentProject();
  const { key, value } = parseIdentity(target.identity);
  if (key === "remote" || key === "draft") {
    if (!ready) return <LoadingScreen message="Loading pipeline..." />;
    if (!configured)
      return <p role="alert">Configure a backend to open pipelines.</p>;
  }
  let pipelineRef: EditorPipelineRef;
  try {
    pipelineRef =
      key === "remote"
        ? { source: "remote", backendUrl, pipelineId: value }
        : key === "draft"
          ? storage.getRemoteDraftRef(value, backendUrl)
          : key === "id"
            ? { fileId: value, name: title }
            : { name: value };
  } catch (error) {
    return (
      <Paragraph role="alert">
        {error instanceof Error
          ? error.message
          : "This pipeline is unavailable. Close this tab and reopen the pipeline."}
      </Paragraph>
    );
  }
  return (
    <EmbeddedPipelineEditor
      pipelineRef={pipelineRef}
      {...props}
      onMigrated={(file) =>
        project.replaceWorkareaTarget(target, pipelineFileTarget(file))
      }
    />
  );
}

registerWorkareaKind({
  type: "pipeline",
  icon: "GitBranch",
  keepMounted: true,
  resolveTitle: async (target) => {
    const { key, value } = parseIdentity(target.identity);
    if (key === "name") return value;
    if (key === "remote" || key === "draft") return value;
    const entry = await findById(value).catch(() => undefined);
    return entry?.storageKey ?? value;
  },
  render: (tab, hostProps) => (
    <PipelineWorkareaEditor
      target={tab.target}
      title={tab.title}
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

import { Controls, ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { RemotePipelineNodeLinkButton } from "@/routes/v2/pages/Editor/components/RemotePipelineNodeLinkButton";
import { useRemotePipelineUrlSync } from "@/routes/v2/pages/Editor/hooks/useRemotePipelineUrlSync";
import { ReadOnlyFlowCanvas } from "@/routes/v2/shared/components/ReadOnlyFlowCanvas";
import { useReadOnlySpecLifecycle } from "@/routes/v2/shared/hooks/useReadOnlySpecLifecycle";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { RemotePipelineShell } from "./RemotePipelineShell";
import { remotePipelineViewRegistry } from "./remotePipelineViewRegistry";

function RemotePipelineUrlSync({
  spec,
  pipelineId,
}: {
  spec: ComponentSpec;
  pipelineId: string;
}) {
  useRemotePipelineUrlSync(spec, pipelineId);
  return null;
}

const SelectedNodeLink = observer(function SelectedNodeLink({
  pipelineId,
}: {
  pipelineId: string;
}) {
  const { navigation, editor } = useSharedStores();
  const spec = navigation.activeSpec;
  const type = editor.selectedNodeType;
  if (!spec || (type !== "task" && type !== "input" && type !== "output"))
    return null;

  const entities =
    type === "task"
      ? spec.tasks
      : type === "input"
        ? spec.inputs
        : spec.outputs;
  const node = entities.find((entity) => entity.$id === editor.selectedNodeId);
  if (!node) return null;

  return (
    <RemotePipelineNodeLinkButton
      pipelineId={pipelineId}
      nodeName={node.name}
      nodeType={type}
    />
  );
});

const RemotePipelineContent = observer(function RemotePipelineContent({
  spec,
  isActive,
  pipelineId,
}: {
  spec: ComponentSpec;
  isActive: boolean;
  pipelineId?: string;
}) {
  const { navigation } = useSharedStores();
  useReadOnlySpecLifecycle(spec);
  useShortcutListener(isActive);

  const activeSpec = navigation.activeSpec;

  return (
    <RemotePipelineShell
      name={spec.name || "Untitled pipeline"}
      actions={pipelineId && <SelectedNodeLink pipelineId={pipelineId} />}
    >
      {pipelineId && navigation.rootSpec === spec && (
        <RemotePipelineUrlSync spec={spec} pipelineId={pipelineId} />
      )}
      {activeSpec && (
        <SpecProvider spec={activeSpec}>
          <ReadOnlyFlowCanvas
            key={activeSpec.$id}
            spec={activeSpec}
            nodesDraggable={false}
            className="flex-1 min-h-0"
          >
            <Controls showInteractive={false} />
          </ReadOnlyFlowCanvas>
        </SpecProvider>
      )}
    </RemotePipelineShell>
  );
});

export function RemotePipelineView({
  spec,
  isActive = true,
  pipelineId,
}: {
  spec: ComponentSpec;
  isActive?: boolean;
  pipelineId?: string;
}) {
  return (
    <ComponentLibraryProvider>
      <SharedStoreProvider>
        <ReactFlowProvider>
          <NodeRegistryProvider registry={remotePipelineViewRegistry}>
            <RemotePipelineContent
              spec={spec}
              isActive={isActive}
              pipelineId={pipelineId}
            />
          </NodeRegistryProvider>
        </ReactFlowProvider>
      </SharedStoreProvider>
    </ComponentLibraryProvider>
  );
}

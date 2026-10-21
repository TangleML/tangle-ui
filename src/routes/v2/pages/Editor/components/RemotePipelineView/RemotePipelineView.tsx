import { Controls, ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
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

const RemotePipelineContent = observer(function RemotePipelineContent({
  spec,
  isActive,
}: {
  spec: ComponentSpec;
  isActive: boolean;
}) {
  const { navigation } = useSharedStores();
  useReadOnlySpecLifecycle(spec);
  useShortcutListener(isActive);

  const activeSpec = navigation.activeSpec;

  return (
    <RemotePipelineShell name={spec.name || "Untitled pipeline"}>
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
}: {
  spec: ComponentSpec;
  isActive?: boolean;
}) {
  return (
    <ComponentLibraryProvider>
      <SharedStoreProvider>
        <ReactFlowProvider>
          <NodeRegistryProvider registry={remotePipelineViewRegistry}>
            <RemotePipelineContent spec={spec} isActive={isActive} />
          </NodeRegistryProvider>
        </ReactFlowProvider>
      </SharedStoreProvider>
    </ComponentLibraryProvider>
  );
}

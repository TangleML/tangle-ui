import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { ContextPanelEmptyState } from "@/routes/v2/shared/components/ContextPanelEmptyState";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const RunViewContextPanel = observer(function RunViewContextPanel() {
  const registry = useNodeRegistry();
  const { editor } = useSharedStores();
  const { selectedNodeId, selectedNodeType } = editor;

  if (!selectedNodeId || !selectedNodeType) {
    return <ContextPanelEmptyState />;
  }

  const manifest = registry.get(selectedNodeType);
  const Panel = manifest?.contextPanelComponent;

  if (!Panel) return <ContextPanelEmptyState />;

  return (
    <BlockStack className="h-full bg-white overflow-y-auto overflow-x-hidden">
      <Panel entityId={selectedNodeId} />
    </BlockStack>
  );
});

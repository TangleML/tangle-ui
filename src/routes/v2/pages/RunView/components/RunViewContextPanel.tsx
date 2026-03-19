import "@/routes/v2/pages/RunView/nodes";

import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { ContextPanelEmptyState } from "@/routes/v2/shared/components/ContextPanelEmptyState";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import { editorStore } from "@/routes/v2/shared/store/editorStore";

export const RunViewContextPanel = observer(function RunViewContextPanel() {
  const { selectedNodeId, selectedNodeType } = editorStore;

  if (!selectedNodeId || !selectedNodeType) {
    return <ContextPanelEmptyState />;
  }

  const manifest = NODE_TYPE_REGISTRY.get(selectedNodeType);
  const Panel = manifest?.contextPanelComponent;

  if (!Panel) return <ContextPanelEmptyState />;

  return (
    <BlockStack className="h-full bg-white overflow-y-auto overflow-x-hidden">
      <Panel entityId={selectedNodeId} />
    </BlockStack>
  );
});

import "@/routes/v2/pages/Editor/nodes"; // ensure manifests are registered

import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { ContextPanelEmptyState } from "@/routes/v2/shared/components/ContextPanelEmptyState";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { MultiSelectionDetails } from "./components/MultiSelectionDetails/MultiSelectionDetails";

/**
 * Content for the Context Panel window.
 * Displays details about the selected node and allows editing via direct mutation.
 * Used within the Windows system.
 */
export const ContextPanelContent = observer(function ContextPanelContent() {
  const { editor } = useSharedStores();
  const { selectedNodeId, selectedNodeType, multiSelection } = editor;

  const spec = useSpec();

  if (multiSelection.length > 1) {
    return <MultiSelectionDetails />;
  }

  if (!selectedNodeId || !selectedNodeType || !spec) {
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

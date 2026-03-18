import "@/routes/EditorV2/nodes"; // ensure manifests are registered

import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { NODE_TYPE_REGISTRY } from "@/routes/EditorV2/nodes/registry";
import { useSpec } from "@/routes/EditorV2/providers/SpecContext";
import { editorStore } from "@/routes/EditorV2/store/editorStore";

import { MultiSelectionDetails } from "./components/MultiSelectionDetails/MultiSelectionDetails";

/**
 * Content for the Context Panel window.
 * Displays details about the selected node and allows editing via direct mutation.
 * Used within the Windows system.
 */
export const ContextPanelContent = observer(function ContextPanelContent() {
  const { selectedNodeId, selectedNodeType, multiSelection } = editorStore;

  const spec = useSpec();

  if (multiSelection.length > 1) {
    return <MultiSelectionDetails />;
  }

  if (!selectedNodeId || !selectedNodeType || !spec) {
    return <EmptyState />;
  }

  const manifest = NODE_TYPE_REGISTRY.get(selectedNodeType);
  const Panel = manifest?.contextPanelComponent;

  if (!Panel) return <EmptyState />;

  return (
    <BlockStack className="h-full bg-white overflow-y-auto overflow-x-hidden">
      <Panel entityId={selectedNodeId} />
    </BlockStack>
  );
});

function EmptyState() {
  return (
    <BlockStack className="h-full items-center justify-center p-4">
      <Icon name="MousePointerClick" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        Select a node to view details
      </Text>
    </BlockStack>
  );
}

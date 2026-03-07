import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../../providers/SpecContext";
import { editorStore } from "../../store/editorStore";
import { InputDetails } from "./components/InputDetails";
import { MultiSelectionDetails } from "./components/MultiSelectionDetails/MultiSelectionDetails";
import { OutputDetails } from "./components/OutputDetails";
import { TaskDetails } from "./components/TaskDetails/TaskDetails";

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

  return (
    <BlockStack className="h-full bg-white overflow-y-auto overflow-x-hidden">
      {selectedNodeType === "task" && <TaskDetails entityId={selectedNodeId} />}
      {selectedNodeType === "input" && (
        <InputDetails entityId={selectedNodeId} />
      )}
      {selectedNodeType === "output" && (
        <OutputDetails entityId={selectedNodeId} />
      )}
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

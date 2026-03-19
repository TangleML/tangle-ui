import "@/routes/v2/pages/RunView/nodes";

import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { editorStore } from "@/routes/v2/shared/store/editorStore";

import { RunViewTaskDetails } from "./RunViewTaskDetails";

export const RunViewContextPanel = observer(function RunViewContextPanel() {
  const { selectedNodeId, selectedNodeType } = editorStore;

  if (!selectedNodeId || !selectedNodeType) {
    return (
      <BlockStack className="h-full items-center justify-center p-4">
        <Icon name="MousePointerClick" size="lg" className="text-gray-300" />
        <Text size="sm" tone="subdued" className="text-center mt-2">
          Select a node to view details
        </Text>
      </BlockStack>
    );
  }

  if (selectedNodeType === "task") {
    return (
      <BlockStack className="h-full bg-white overflow-y-auto overflow-x-hidden">
        <RunViewTaskDetails entityId={selectedNodeId} />
      </BlockStack>
    );
  }

  return (
    <BlockStack className="h-full items-center justify-center p-4">
      <Text size="sm" tone="subdued" className="text-center">
        Details not available for this node type
      </Text>
    </BlockStack>
  );
});

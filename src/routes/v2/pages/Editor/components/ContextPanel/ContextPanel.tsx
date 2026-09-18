import yaml from "js-yaml";
import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { PinnedTaskContent } from "@/routes/v2/pages/Editor/components/PinnedTaskContent/PinnedTaskContent";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { CodeBlock } from "@/routes/v2/shared/components/CodeBlock";
import { ContextPanelEmptyState } from "@/routes/v2/shared/components/ContextPanelEmptyState";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { MultiSelectionDetails } from "./components/MultiSelectionDetails/MultiSelectionDetails";

export const ContextPanelContent = observer(function ContextPanelContent() {
  const registry = useNodeRegistry();
  const { editor } = useSharedStores();
  const { selectedNodeId, selectedNodeType, multiSelection } = editor;
  const { pipelineFile } = useEditorSession();
  const canEdit = pipelineFile.activePipelineFile?.canEdit ?? false;

  const spec = useSpec();

  if (multiSelection.length > 1) {
    if (!canEdit)
      return (
        <Text className="p-4">{multiSelection.length} nodes selected</Text>
      );
    return <MultiSelectionDetails />;
  }

  if (!selectedNodeId || !selectedNodeType || !spec) {
    return <ContextPanelEmptyState />;
  }

  const manifest = registry.get(selectedNodeType);
  if (!canEdit) {
    if (selectedNodeType === "task")
      return <PinnedTaskContent entityId={selectedNodeId} />;
    const snapshot = manifest?.snapshotHandler?.snapshot(spec, selectedNodeId);
    return snapshot ? (
      <BlockStack className="h-full p-3 overflow-auto">
        <Text weight="semibold">{snapshot.name}</Text>
        <CodeBlock
          code={yaml.dump(snapshot.data)}
          language="yaml"
          showLineNumbers={false}
        />
      </BlockStack>
    ) : (
      <ContextPanelEmptyState />
    );
  }
  const Panel = manifest?.contextPanelComponent;

  if (!Panel) return <ContextPanelEmptyState />;

  return (
    <BlockStack className="h-full bg-card overflow-y-auto overflow-x-hidden">
      <Panel entityId={selectedNodeId} />
    </BlockStack>
  );
});

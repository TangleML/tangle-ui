import type { Node } from "@xyflow/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";

import { ActionButton } from "../../../Buttons/ActionButton";
import { ContentBlock } from "../../../ContextPanel/Blocks/ContentBlock";
import { FlexDetailPanel } from "./FlexDetailPanel";
import { InputDetailPanel } from "./InputDetailPanel";
import { OutputDetailPanel } from "./OutputDetailPanel";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { getNodeDisplayName, getNodeTypeIcon, getNodeTypeLabel } from "./utils";

interface MultiSelectPanelProps {
  selectedNodes: Node[];
  readOnly: boolean;
  onCopy?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUpgrade?: () => void;
  onGroup?: () => void;
  onAutoLayout?: () => void;
}

export const MultiSelectPanel = ({
  selectedNodes,
  readOnly,
  onCopy,
  onDuplicate,
  onDelete,
  onUpgrade,
  onGroup,
  onAutoLayout,
}: MultiSelectPanelProps) => {
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);

  const detailNode = selectedNodes.find((n) => n.id === detailNodeId);

  if (detailNode) {
    return (
      <NodeDetail
        node={detailNode}
        readOnly={readOnly}
        onBack={() => setDetailNodeId(null)}
      />
    );
  }

  return (
    <BlockStack align="start" gap="4" className="p-2">
      <Heading level={2}>{selectedNodes.length} nodes selected</Heading>

      <ContentBlock title="Selected nodes">
        <BlockStack gap="1">
          {selectedNodes.map((node) => {
            const iconName = getNodeTypeIcon(node.type);
            const typeLabel = getNodeTypeLabel(node.type);
            const displayName = getNodeDisplayName(node);

            return (
              <Button
                key={node.id}
                variant="ghost"
                className="w-full h-fit"
                onClick={() => setDetailNodeId(node.id)}
              >
                <InlineStack align="space-between" blockAlign="center" fill>
                  <InlineStack blockAlign="center" gap="2">
                    <Icon
                      name={iconName}
                      className="text-muted-foreground"
                      size="sm"
                    />
                    <Text
                      size="sm"
                      className="truncate whitespace-normal text-left"
                    >
                      {displayName}
                    </Text>
                  </InlineStack>

                  <InlineStack blockAlign="center" gap="1">
                    <Text size="xs" tone="subdued">
                      {typeLabel}
                    </Text>
                    <Icon
                      name="ChevronRight"
                      className="text-muted-foreground"
                      size="sm"
                    />
                  </InlineStack>
                </InlineStack>
              </Button>
            );
          })}
        </BlockStack>
      </ContentBlock>

      <ContentBlock title="Actions">
        <InlineStack gap="1">
          {onUpgrade && (
            <ActionButton
              icon="CircleFadingArrowUp"
              tooltip="Update tasks"
              onClick={onUpgrade}
            />
          )}
          {onGroup && (
            <ActionButton
              icon="Workflow"
              tooltip="Create subgraph"
              onClick={onGroup}
            />
          )}
          {onDuplicate && (
            <ActionButton
              icon="Copy"
              tooltip="Duplicate nodes"
              onClick={onDuplicate}
            />
          )}
          {onCopy && (
            <ActionButton
              icon="ClipboardPlus"
              tooltip="Copy YAML"
              onClick={onCopy}
            />
          )}
          {onAutoLayout && (
            <ActionButton
              icon="LayoutGrid"
              tooltip="Auto layout"
              onClick={onAutoLayout}
            />
          )}
          {onDelete && (
            <ActionButton
              icon="Trash"
              tooltip="Delete all"
              onClick={onDelete}
              destructive
            />
          )}
        </InlineStack>
      </ContentBlock>
    </BlockStack>
  );
};

const NodeDetail = ({
  node,
  readOnly,
  onBack,
}: {
  node: Node;
  readOnly: boolean;
  onBack: () => void;
}) => {
  return (
    <BlockStack inlineAlign="start" align="start" gap="2" fill>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <Icon name="ChevronLeft" />
        Back to selection
      </Button>
      {node.type === "task" && <TaskDetailPanel node={node} />}
      {node.type === "input" && (
        <InputDetailPanel node={node} readOnly={readOnly} />
      )}
      {node.type === "output" && (
        <OutputDetailPanel node={node} readOnly={readOnly} />
      )}
      {node.type === "flex" && (
        <FlexDetailPanel node={node} readOnly={readOnly} />
      )}
    </BlockStack>
  );
};

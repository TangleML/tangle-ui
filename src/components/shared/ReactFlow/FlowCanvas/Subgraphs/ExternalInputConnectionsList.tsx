import { type Node } from "@xyflow/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";

import { NodeListItem } from "./NodeListItem";

interface ExternalInputConnectionsListProps {
  nodes: Node[];
  excludedNodeIds?: Set<string>;
  onExcludeNode?: (nodeId: string) => void;
  onIncludeNode?: (nodeId: string) => void;
}

export function ExternalInputConnectionsList({
  nodes,
  excludedNodeIds,
  onExcludeNode,
  onIncludeNode,
}: ExternalInputConnectionsListProps) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <InfoBox
      className="mt-4"
      title="External Input Connections"
      variant="warning"
      width="full"
    >
      <Paragraph className="mb-4" size="sm">
        These inputs are connected to tasks that are not part of the selection.
        Exclude them to keep their external connections intact.
      </Paragraph>
      <ul className="space-y-2 text-sm">
        {nodes.map((node) => (
          <NodeListItem
            key={node.id}
            node={node}
            excludedNodeIds={excludedNodeIds}
            onExcludeNode={onExcludeNode}
            onIncludeNode={onIncludeNode}
          />
        ))}
      </ul>
    </InfoBox>
  );
}

import { type Node } from "@xyflow/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";

import { NodeListItem } from "./NodeListItem";

interface OrphanedNodeListProps {
  nodes: Node[];
  excludedNodeIds?: Set<string>;
  onExcludeNode?: (nodeId: string) => void;
  onIncludeNode?: (nodeId: string) => void;
}

export function OrphanedNodeList({
  nodes,
  excludedNodeIds,
  onExcludeNode,
  onIncludeNode,
}: OrphanedNodeListProps) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <InfoBox
      className="mt-4"
      title="Orphaned Nodes"
      variant="error"
      width="full"
    >
      <Paragraph className="mb-4" size="sm">
        These nodes are not connected to anything else in the selection. Exclude
        them to create a valid subgraph.
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

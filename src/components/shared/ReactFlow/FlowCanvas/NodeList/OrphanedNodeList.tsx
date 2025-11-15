import { type Node } from "@xyflow/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { getNodeTypeColor } from "./utils";

interface OrphanedNodeListProps {
  nodes: Node[];
}

export function OrphanedNodeList({ nodes }: OrphanedNodeListProps) {
  if (nodes.length === 0) {
    return null;
  }

  return (
    <InfoBox className="mt-4" title="Orphaned Nodes" variant="warning">
      <Paragraph className="mb-4" size="sm">
        Some nodes are not connected to anything else in the selection. Deselect
        them if they are not needed inside the new subgraph.
      </Paragraph>
      <ul className="space-y-2 text-sm">
        {nodes.map((node) => (
          <li key={node.id} className="flex items-center gap-3">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                getNodeTypeColor(node.type),
              )}
            />
            <Paragraph font="mono" size="xs">
              {node.id}
            </Paragraph>
          </li>
        ))}
      </ul>
    </InfoBox>
  );
}

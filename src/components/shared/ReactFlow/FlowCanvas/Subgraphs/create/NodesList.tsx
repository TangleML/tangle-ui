import { type Node } from "@xyflow/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { NodeListItem } from "./NodeListItem";

interface NodesListProps {
  nodes: Node[];
  title?: string;
  excludedNodeIds?: Set<string>;
  orphanedNodeIds?: Set<string>;
  onExcludeNode?: (nodeId: string) => void;
  onIncludeNode?: (nodeId: string) => void;
}

export function NodesList({
  nodes,
  title = `View nodes (${nodes.length})`,
  excludedNodeIds,
  orphanedNodeIds,
  onExcludeNode,
  onIncludeNode,
}: NodesListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (nodes.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button variant="ghost">
          <ChevronRight
            className={cn(
              "transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
          {title}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="rounded-md border p-3 bg-secondary/50 max-h-[50vh] overflow-auto">
          <ul className="space-y-2 text-sm">
            {nodes.map((node) => (
              <NodeListItem
                key={node.id}
                node={node}
                excludedNodeIds={excludedNodeIds}
                isOrphaned={orphanedNodeIds?.has(node.id)}
                onExcludeNode={onExcludeNode}
                onIncludeNode={onIncludeNode}
              />
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

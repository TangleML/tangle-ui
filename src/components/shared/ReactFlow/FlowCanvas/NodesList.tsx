import { type Node } from "@xyflow/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface NodesListProps {
  nodes: Node[];
  title?: string;
}

const getNodeTypeColor = (nodeType: string | undefined): string => {
  switch (nodeType) {
    case "input":
      return "bg-blue-500";
    case "output":
      return "bg-violet-500";
    case "task":
    default:
      return "bg-gray-500";
  }
};

export function NodesList({
  nodes,
  title = `View nodes (${nodes.length})`,
}: NodesListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (nodes.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
        <div className="rounded-md border p-3 bg-secondary/50">
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

import { type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { isFlexNode } from "../../types";
import { getNodeTypeColor } from "./utils";

interface NodeListItemProps {
  node: Node;
  excludedNodeIds?: Set<string>;
  isOrphaned?: boolean;
  onExcludeNode?: (nodeId: string) => void;
  onIncludeNode?: (nodeId: string) => void;
}

export function NodeListItem({
  node,
  excludedNodeIds,
  isOrphaned,
  onExcludeNode,
  onIncludeNode,
}: NodeListItemProps) {
  const isExcluded = excludedNodeIds?.has(node.id);

  const handleButtonClick = () => {
    if (onExcludeNode && !isExcluded) {
      onExcludeNode(node.id);
    } else if (onIncludeNode && isExcluded) {
      onIncludeNode(node.id);
    }
  };

  const isFlexType = isFlexNode(node);

  const displayValue = isFlexType
    ? `Sticky Note: ${node.data.properties.title.length > 0 ? node.data.properties.title : node.id}`
    : node.id;

  return (
    <li key={node.id} className="flex justify-between items-center">
      <InlineStack
        gap="3"
        className={cn({ "opacity-50": isExcluded })}
        wrap="nowrap"
      >
        <Badge
          variant="dot"
          className={cn(getNodeTypeColor(node.type))}
          style={{
            backgroundColor: isFlexType
              ? node.data.properties.color
              : undefined,
            filter: isFlexType ? "brightness(0.8)" : undefined,
          }}
        />
        <Paragraph font="mono" size="xs">
          {displayValue}
        </Paragraph>
        {isOrphaned && (
          <InlineStack gap="1" wrap="nowrap">
            <Icon name="TriangleAlert" className="text-destructive" />
            <Paragraph size="xs" className="text-destructive">
              Orphaned
            </Paragraph>
          </InlineStack>
        )}
      </InlineStack>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleButtonClick}
        className={cn(
          "hover:bg-transparent",
          isExcluded
            ? "text-muted-foreground hover:text-primary"
            : "hover:text-destructive",
        )}
      >
        {isExcluded ? <Icon name="SquarePlus" /> : <Icon name="Delete" />}
      </Button>
    </li>
  );
}

import { type Node } from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { getNodeTypeColor } from "./utils";

interface NodeListItemProps {
  node: Node;
  isOrphaned?: boolean;
}

export function NodeListItem({ node, isOrphaned }: NodeListItemProps) {
  return (
    <li key={node.id} className="flex justify-between items-center">
      <InlineStack gap="3" blockAlign="center" wrap="nowrap">
        <Badge variant="dot" className={cn(getNodeTypeColor(node.type))} />
        <Paragraph font="mono" size="xs">
          {node.id}
        </Paragraph>
        {isOrphaned && (
          <InlineStack gap="1" blockAlign="center" wrap="nowrap">
            <Icon name="TriangleAlert" className="text-destructive" />
            <Paragraph size="xs" className="text-destructive">
              Orphaned
            </Paragraph>
          </InlineStack>
        )}
      </InlineStack>
    </li>
  );
}

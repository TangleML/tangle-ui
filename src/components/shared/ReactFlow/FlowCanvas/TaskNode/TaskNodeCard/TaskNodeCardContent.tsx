import type { ReactNode, RefObject } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { TaskNodeDimensions } from "@/types/taskNode";

interface TaskNodeCardContentProps {
  name: string;
  taskId?: string;
  dimensions: TaskNodeDimensions;
  selected?: boolean;
  highlighted?: boolean;
  isSubgraphNode?: boolean;
  nodeRef?: RefObject<HTMLDivElement | null>;
  onDoubleClick?: () => void;
  headerActions?: ReactNode;
  headerIcons?: ReactNode;
  children: ReactNode;
}

export const TaskNodeCardContent = ({
  name,
  taskId,
  dimensions,
  selected = false,
  highlighted = false,
  isSubgraphNode = false,
  nodeRef,
  onDoubleClick,
  headerActions,
  headerIcons,
  children,
}: TaskNodeCardContentProps) => {
  return (
    <Card
      className={cn(
        "rounded-2xl border-gray-200 border-2 wrap-break-word p-0 drop-shadow-none gap-2",
        selected ? "border-gray-500" : "hover:border-slate-200",
        highlighted && "border-orange-500!",
        isSubgraphNode && "cursor-pointer",
      )}
      style={{
        width: dimensions.w + "px",
        height: "auto",
      }}
      ref={nodeRef}
      onDoubleClick={onDoubleClick}
    >
      <CardHeader className="border-b border-slate-200 px-2 py-2.5 flex flex-row justify-between items-start">
        <BlockStack>
          <InlineStack gap="2" blockAlign="center" wrap="nowrap">
            {headerIcons}
            <CardTitle className="wrap-break-word text-left text-xs text-slate-900">
              {name}
            </CardTitle>
          </InlineStack>
          {taskId &&
            taskId !== name &&
            !taskId.match(new RegExp(`^${name}\\s*\\d+$`)) && (
              <Text size="xs" tone="subdued" className="font-light">
                {taskId}
              </Text>
            )}
        </BlockStack>
        {headerActions}
      </CardHeader>
      <CardContent className="p-2 flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
};

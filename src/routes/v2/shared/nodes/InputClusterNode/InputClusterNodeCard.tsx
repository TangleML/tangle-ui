import { Handle, Position } from "@xyflow/react";
import { type MouseEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PORT_ROW_GAP,
  PORT_ROW_HEIGHT,
} from "@/routes/v2/shared/nodes/nodeLayout";
import { pluralize } from "@/utils/string";

import type { InputClusterMember } from "./types";

export interface InputClusterNodeCardProps {
  members: InputClusterMember[];
  selected: boolean;
  hoveredEntityId: string | null;
  onMemberClick: (entityId: string, event: MouseEvent) => void;
}

export function InputClusterNodeCard({
  members,
  selected,
  hoveredEntityId,
  onMemberClick,
}: InputClusterNodeCardProps) {
  const borderColor = selected
    ? "border-blue-500 dark:ring-2 dark:ring-blue-400/60"
    : "border-blue-300 hover:border-blue-400 dark:border-blue-500 dark:hover:border-blue-600";

  return (
    <Card
      className={cn(
        "border-2 w-64 p-0 cursor-grab transition-all bg-io-input",
        borderColor,
      )}
      data-testid="input-cluster-node"
    >
      <CardHeader className="p-2">
        <CardTitle className="text-sm text-ink-fixed">
          <InlineStack gap="1" blockAlign="center" wrap="nowrap">
            <Icon
              name="SquareArrowRightEnter"
              className="text-blue-600 h-4! w-4!"
            />
            <span>
              {members.length} {pluralize(members.length, "input")}
            </span>
          </InlineStack>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="flex flex-col w-full" style={{ gap: PORT_ROW_GAP }}>
          {members.map((member) => {
            const isHovered = member.entityId === hoveredEntityId;
            return (
              <div
                key={member.entityId}
                className="relative flex items-center justify-end w-full cursor-pointer"
                style={{ height: PORT_ROW_HEIGHT }}
                onClick={(event) => {
                  event.stopPropagation();
                  onMemberClick(member.entityId, event);
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "text-xs rounded-md px-2 py-0.5 truncate max-w-full text-ink-fixed",
                        isHovered
                          ? "bg-amber-300/60"
                          : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15",
                      )}
                    >
                      {member.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{member.name}</TooltipContent>
                </Tooltip>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`output_${member.entityId}`}
                  className="relative! border-0! w-3! h-3! transform-none! translate-x-6 bg-gray-500!"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

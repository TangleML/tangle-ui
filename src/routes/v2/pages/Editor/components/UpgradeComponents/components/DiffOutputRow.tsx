import { Handle, Position } from "@xyflow/react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { DiffEntry } from "@/routes/v2/pages/Editor/store/actions/task.utils";
import type { TaskNodeOutput } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";

import {
  DIFF_STATUS_CLASSES,
  HANDLE_STATUS_CLASSES,
  STATUS_ICON,
} from "./upgradePreviewConstants";

export function DiffOutputRow({ entry, status }: DiffEntry<TaskNodeOutput>) {
  const icon = STATUS_ICON[status];
  return (
    <InlineStack blockAlign="center" className="w-full justify-end">
      <InlineStack
        blockAlign="center"
        className="w-full gap-0.5 flex-row-reverse justify-between"
      >
        <div className="translate-x-3 min-w-0 inline-block max-w-full">
          <InlineStack blockAlign="center" className="gap-1">
            <div
              className={cn(
                "text-xs rounded-md px-2 py-1 truncate",
                DIFF_STATUS_CLASSES[status],
              )}
              title={`${entry.name}${entry.type ? `: ${entry.type}` : ""}`}
            >
              {entry.name.replace(/_/g, " ")}
            </div>
            {icon && (
              <Icon
                name={icon.name}
                size="xs"
                className={cn("shrink-0", icon.className)}
              />
            )}
          </InlineStack>
        </div>
      </InlineStack>
      <Handle
        type="source"
        position={Position.Right}
        id={`output_${entry.name}`}
        className={cn(
          "!relative !border-0 !w-3 !h-3 !transform-none !translate-x-6",
          HANDLE_STATUS_CLASSES[status],
        )}
      />
    </InlineStack>
  );
}

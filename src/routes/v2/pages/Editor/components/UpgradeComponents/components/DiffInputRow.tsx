import { Handle, Position } from "@xyflow/react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import type { DiffEntry } from "@/routes/v2/pages/Editor/store/actions/task.utils";
import type { TaskNodeInput } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";

import {
  DIFF_STATUS_CLASSES,
  HANDLE_STATUS_CLASSES,
  STATUS_ICON,
} from "./upgradePreviewConstants";

export function DiffInputRow({ entry, status }: DiffEntry<TaskNodeInput>) {
  const icon = STATUS_ICON[status];
  return (
    <div className="relative w-full h-fit">
      <div className="absolute -translate-x-6 flex items-center h-3 w-3">
        <Handle
          type="target"
          position={Position.Left}
          id={`input_${entry.name}`}
          className={cn(
            "!border-0 !h-full !w-full !transform-none",
            HANDLE_STATUS_CLASSES[status],
          )}
        />
      </div>
      <InlineStack blockAlign="center" className="w-full gap-1 rounded-md">
        {icon && (
          <Icon
            name={icon.name}
            size="xs"
            className={cn("shrink-0", icon.className)}
          />
        )}
        <div
          className={cn(
            "text-xs rounded-md px-2 py-1 truncate",
            DIFF_STATUS_CLASSES[status],
          )}
          title={`${entry.name}${entry.type ? `: ${entry.type}` : ""}`}
        >
          {entry.name.replace(/_/g, " ")}
        </div>
      </InlineStack>
    </div>
  );
}

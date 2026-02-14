import type { DragEvent } from "react";
import { useCallback } from "react";

import { InlineStack } from "@/components/ui/layout";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import type { Building } from "../data/types";

interface BuildingItemProps {
  building: Building;
}

const BuildingItem = ({ building }: BuildingItemProps) => {
  const onDragStart = useCallback(
    (event: DragEvent) => {
      event.dataTransfer.setData(
        "application/reactflow",
        JSON.stringify({ building }),
      );

      event.dataTransfer.setData(
        "DragStart.offset",
        JSON.stringify({
          offsetX: event.nativeEvent.offsetX,
          offsetY: event.nativeEvent.offsetY,
        }),
      );

      event.dataTransfer.effectAllowed = "move";
    },
    [building],
  );

  return (
    <SidebarMenuItem
      className={cn(
        "px-2 py-1.5 rounded-sm w-full",
        "cursor-grab hover:bg-gray-100 active:bg-gray-200",
      )}
      draggable
      onDragStart={onDragStart}
      data-testid="building-item"
      data-building-id={building.id}
    >
      <InlineStack wrap="nowrap" gap="2" className="w-full">
        <span className="text-xl shrink-0">{building.icon}</span>
        <div className="flex flex-col flex-1 min-w-0">
          <span
            className="truncate text-xs text-gray-800 font-medium"
            title={building.name}
          >
            {building.name}
          </span>
          <span className="truncate text-[10px] text-gray-500">
            {building.description}
          </span>
          <span className="text-[10px] text-amber-600 font-semibold">
            💰 {building.cost}
          </span>
        </div>
      </InlineStack>
    </SidebarMenuItem>
  );
};

export default BuildingItem;

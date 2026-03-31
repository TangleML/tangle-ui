import type { DragEvent } from "react";

import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

import BuildingIcon from "../components/BuildingIcon";
import { getBuildingDefinition } from "../data/buildings";
import { RESOURCES } from "../data/resources";
import { useGlobalResources } from "../providers/GlobalResourcesProvider";
import type { BuildingType } from "../types/buildings";

interface BuildingItemProps {
  buildingType: BuildingType;
}

const BuildingItem = ({ buildingType }: BuildingItemProps) => {
  const building = getBuildingDefinition(buildingType);
  const { getResource } = useGlobalResources();
  const money = getResource("money");
  const canAfford = money >= building.cost;

  const onDragStart = (event: DragEvent) => {
    if (!canAfford) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ buildingType }),
    );

    event.dataTransfer.setData(
      "DragStart.offset",
      JSON.stringify({
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
      }),
    );

    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={cn(
        "px-2 py-1.5 rounded-sm w-full",
        canAfford
          ? "cursor-grab hover:bg-gray-100 active:bg-gray-200"
          : "cursor-not-allowed opacity-50",
      )}
      draggable={canAfford}
      onDragStart={onDragStart}
    >
      <InlineStack wrap="nowrap" gap="2" className="w-full">
        <BuildingIcon icon={building.icon} />
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
          <span
            className={cn(
              "text-[10px] font-semibold",
              canAfford ? "text-amber-600" : "text-red-500",
            )}
          >
            {RESOURCES.money.icon} {building.cost}
          </span>
        </div>
      </InlineStack>
    </div>
  );
};

export default BuildingItem;

import { Handle } from "@xyflow/react";

import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { RESOURCE_COLORS } from "../../data/resources";
import {
  type BuildingInstance,
  type BuildingOutput as BuildingOutputConfig,
} from "../../types/buildings";
import { isLightColor } from "../../utils/color";
import { layoutHandleAtPosition } from "./utils";

const BuildingOutput = ({
  building,
  output,
  selected,
  index,
  groupIndex,
  totalInGroup,
}: {
  building: BuildingInstance;
  output: BuildingOutputConfig;
  selected?: boolean;
  index: number;
  groupIndex: number;
  totalInGroup: number;
}) => {
  const { resource, position } = output;

  if (!position) {
    return null;
  }

  return (
    <Handle
      type="source"
      position={position}
      id={`output-building:${building.id}-resource:${resource}-${index}`}
      className={cn(selected && "border-selected!")}
      style={{
        background: RESOURCE_COLORS[resource],
        width: 12,
        height: 12,
        border: `1px solid ${building.color}`,
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        ...layoutHandleAtPosition({
          position,
          groupIndex,
          totalInGroup,
        }),
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Icon
              name="ArrowDown"
              className={cn(
                "p-1",
                isLightColor(RESOURCE_COLORS[resource])
                  ? "text-black"
                  : "text-white",
                {
                  "rotate-90": position === "left",
                  "-rotate-90": position === "right",
                  "rotate-180": position === "top",
                  "rotate-0": position === "bottom",
                },
              )}
            />
          </TooltipTrigger>
          <TooltipContent>Output: {resource}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Handle>
  );
};

export default BuildingOutput;

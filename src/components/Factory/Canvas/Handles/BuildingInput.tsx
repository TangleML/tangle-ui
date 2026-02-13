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
  type BuildingInput as BuildingInputConfig,
  type BuildingInstance,
} from "../../types/buildings";
import { isLightColor } from "../../utils/color";
import { layoutHandleAtPosition } from "./utils";

const BuildingInput = ({
  building,
  input,
  selected,
  index,
  groupIndex,
  totalInGroup,
}: {
  building: BuildingInstance;
  input: BuildingInputConfig;
  selected?: boolean;
  index: number;
  groupIndex: number;
  totalInGroup: number;
}) => {
  const { resource, position } = input;

  if (!position) {
    return null;
  }

  return (
    <Handle
      type="target"
      position={position}
      id={`input-building:${building.id}-resource:${resource}-${index}`}
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
              name="ArrowUp"
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
          <TooltipContent>Input: {resource}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Handle>
  );
};

export default BuildingInput;

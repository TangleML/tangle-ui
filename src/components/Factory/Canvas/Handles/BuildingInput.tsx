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
  type Building,
  type BuildingInput as BuildingInputConfig,
} from "../../types/buildings";
import { isLightColor } from "../../utils/color";

const BuildingInput = ({
  building,
  input,
  selected,
}: {
  building: Building;
  input: BuildingInputConfig;
  selected?: boolean;
}) => {
  const { resource, position } = input;

  return (
    <Handle
      type="target"
      position={position}
      id={`input-${building.id}-${position}-${resource}`}
      className={cn(selected && "border-selected!")}
      style={{
        background: RESOURCE_COLORS[resource],
        width: 12,
        height: 12,
        border: `1px solid ${building.color}`,
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
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

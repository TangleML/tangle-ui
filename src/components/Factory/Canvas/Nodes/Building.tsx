import {
  type NodeProps,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

import { isBuildingData } from "../../types/buildings";
import { rotateBuilding } from "../../utils/rotation";
import BuildingInput from "../Handles/BuildingInput";
import BuildingOutput from "../Handles/BuildingOutput";

const Building = ({ id, data, selected }: NodeProps) => {
  const { updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    if (!selected) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isBuildingData(data)) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        const rotatedData = rotateBuilding(data);
        updateNodeData(id, { ...rotatedData });
        updateNodeInternals(id);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selected, id, data, updateNodeData, updateNodeInternals]);

  if (!isBuildingData(data)) {
    return (
      <div className="px-6 py-4 shadow-lg rounded-lg bg-red-50 border-4 border-red-500">
        <div className="font-bold text-lg text-red-900">Invalid Building</div>
        <div className="text-sm text-red-700 mt-1">Data is not valid</div>
      </div>
    );
  }

  const { icon, name, description, color, inputs = [], outputs = [] } = data;

  // Calculate position counts
  const inputCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inputs.forEach((input) => {
      counts[input.position] = (counts[input.position] || 0) + 1;
    });
    return counts;
  }, [inputs]);

  const outputCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    outputs.forEach((output) => {
      counts[output.position] = (counts[output.position] || 0) + 1;
    });
    return counts;
  }, [outputs]);

  // Track index at each position
  const inputIndexAtPosition: Record<string, number> = {};
  const outputIndexAtPosition: Record<string, number> = {};

  return (
    <div
      className={cn("bg-white rounded-lg", selected && "ring-2 ring-selected")}
    >
      {inputs.map((input, globalIndex) => {
        const posIndex = inputIndexAtPosition[input.position] || 0;
        inputIndexAtPosition[input.position] = posIndex + 1;

        return (
          <BuildingInput
            key={globalIndex}
            building={data}
            input={input}
            selected={selected}
            index={globalIndex}
            groupIndex={posIndex}
            totalInGroup={inputCounts[input.position]}
          />
        );
      })}

      <div
        className="px-6 py-4 shadow-lg rounded-lg border-4"
        style={{ borderColor: color, backgroundColor: `${color}20` }}
      >
        <div className="font-bold text-lg" style={{ color }}>
          {icon} {name}
        </div>
        <div className="text-sm mt-1 text-center" style={{ color }}>
          {description}
        </div>
      </div>

      {outputs.map((output, globalIndex) => {
        const posIndex = outputIndexAtPosition[output.position] || 0;
        outputIndexAtPosition[output.position] = posIndex + 1;

        return (
          <BuildingOutput
            key={globalIndex}
            building={data}
            output={output}
            selected={selected}
            index={globalIndex}
            groupIndex={posIndex}
            totalInGroup={outputCounts[output.position]}
          />
        );
      })}
    </div>
  );
};

export default Building;

import {
  type NodeProps,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useContextPanel } from "@/providers/ContextPanelProvider";

import { ProductionFeedback } from "../../components/ProductionFeedback";
import BuildingContext from "../../Context/Building/BuildingContext";
import { isGlobalResource } from "../../data/resources";
import { useStatistics } from "../../providers/StatisticProvider";
import type {
  BuildingInput as BuildingInputType,
  BuildingOutput as BuildingOutputType,
} from "../../types/buildings";
import { getBuildingInstance } from "../../types/buildings";
import { rotateBuilding } from "../../utils/rotation";
import BuildingInput from "../Handles/BuildingInput";
import BuildingOutput from "../Handles/BuildingOutput";

const Building = ({ id, data, selected }: NodeProps) => {
  const buildingRef = useRef<HTMLDivElement>(null);

  const { updateNodeData, getNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

  const { currentDay, getLatestBuildingStats } = useStatistics();
  const buildingStats = getLatestBuildingStats(id);
  const instance = getBuildingInstance(data);

  useEffect(() => {
    if (!selected) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (!instance) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        const rotatedData = rotateBuilding(instance);
        updateNodeData(id, { buildingInstance: rotatedData });
        updateNodeInternals(id);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selected, id, instance, updateNodeData, updateNodeInternals]);

  useEffect(() => {
    if (selected) {
      const buildingInstance = getBuildingInstance(data);

      if (!buildingInstance) {
        setContent(<InvalidBuildingNode />);
        setContextPanelOpen(true);
        return;
      }

      setContent(<BuildingContext building={buildingInstance} nodeId={id} />);
      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [selected, data, getNode, setContent, clearContent, setContextPanelOpen]);

  if (!instance) {
    return <InvalidBuildingNode />;
  }

  const {
    icon,
    name,
    description,
    color,
    inputs = [],
    outputs = [],
  } = instance;

  // Calculate position counts
  const inputCounts = countBuildingIO(inputs);
  const outputCounts = countBuildingIO(outputs);

  // Track index at each position
  const inputIndexAtPosition: Record<string, number> = {};
  const outputIndexAtPosition: Record<string, number> = {};

  return (
    <div
      className={cn("bg-white rounded-lg", selected && "ring-2 ring-selected")}
      ref={buildingRef}
    >
      <ProductionFeedback
        buildingRef={buildingRef}
        statistics={buildingStats}
        day={currentDay}
      />

      {inputs.map((input, globalIndex) => {
        if (!input.position) return null;

        const isGlobal = isGlobalResource(input.resource);
        if (isGlobal) return;

        const posIndex = inputIndexAtPosition[input.position] || 0;
        inputIndexAtPosition[input.position] = posIndex + 1;

        return (
          <BuildingInput
            key={globalIndex}
            building={instance}
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
        if (!output.position) return null;

        const isGlobal = isGlobalResource(output.resource);
        if (isGlobal) return;

        const posIndex = outputIndexAtPosition[output.position] || 0;
        outputIndexAtPosition[output.position] = posIndex + 1;

        return (
          <BuildingOutput
            key={globalIndex}
            building={instance}
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

function countBuildingIO(ios: (BuildingInputType | BuildingOutputType)[]) {
  const counts: Record<string, number> = {};
  ios.forEach((io) => {
    if (!io.position) return;

    counts[io.position] = (counts[io.position] || 0) + 1;
  });
  return counts;
}

const InvalidBuildingNode = () => (
  <div className="px-6 py-4 shadow-lg rounded-lg bg-red-50 border-4 border-red-500">
    <div className="font-bold text-lg text-red-900">Invalid Building</div>
    <div className="text-sm text-red-700 mt-1">Data is not valid</div>
  </div>
);

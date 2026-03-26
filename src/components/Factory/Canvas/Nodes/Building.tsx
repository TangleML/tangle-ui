import type { NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";

import { isBuildingData } from "../../data/types";

const Building = ({ data, selected }: NodeProps) => {
  if (!isBuildingData(data)) {
    return (
      <div className="px-6 py-4 shadow-lg rounded-lg bg-red-50 border-4 border-red-500">
        <div className="font-bold text-lg text-red-900">Invalid Building</div>
        <div className="text-sm text-red-700 mt-1">Data is not valid</div>
      </div>
    );
  }

  const { icon, name, description, color } = data;

  return (
    <div
      className={cn("bg-white rounded-lg", selected && "ring-2 ring-blue-500")}
    >
      <div
        className="px-6 py-4 shadow-lg rounded-lg border-4"
        style={{ borderColor: color, backgroundColor: `${color}20` }}
      >
        <div className="font-bold text-lg" style={{ color }}>
          {icon} {name}
        </div>
        <div className="text-sm mt-1" style={{ color }}>
          {description}
        </div>
      </div>
    </div>
  );
};

export default Building;

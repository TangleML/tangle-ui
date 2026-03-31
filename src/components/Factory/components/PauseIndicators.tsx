import { RESOURCES } from "../data/resources";
import type { BuildingStatistics } from "../types/statistics";

interface PauseIndicatorsProps {
  statistics?: BuildingStatistics;
}

export const PauseIndicators = ({ statistics }: PauseIndicatorsProps) => {
  if (!statistics) return null;

  const { maintenancePaused, knowledgePaused } = statistics;
  if (!maintenancePaused && !knowledgePaused) return null;

  return (
    <div className="absolute -top-2 -right-2 flex gap-0.5 z-10">
      {maintenancePaused && (
        <span
          className="relative flex items-center justify-center w-5 h-5 rounded-full bg-red-100 border border-red-300 text-xs"
          title="Paused — insufficient funds"
        >
          {RESOURCES.money.icon}
          <span className="absolute inset-0 flex items-center justify-center text-red-600 font-bold text-[10px] pointer-events-none">
            ✕
          </span>
        </span>
      )}
      {knowledgePaused && (
        <span
          className="relative flex items-center justify-center w-5 h-5 rounded-full bg-red-100 border border-red-300 text-xs"
          title="Paused — insufficient knowledge"
        >
          {RESOURCES.knowledge.icon}
          <span className="absolute inset-0 flex items-center justify-center text-red-600 font-bold text-[10px] pointer-events-none">
            ✕
          </span>
        </span>
      )}
    </div>
  );
};

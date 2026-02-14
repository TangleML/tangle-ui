import React, { createContext, useContext, useState } from "react";

import type { DayStatistics } from "../types/statistics";

interface StatisticsContextType {
  history: DayStatistics[];
  addDayStatistics: (stats: DayStatistics) => void;
  currentDay: number;
  getLatestBuildingStats: (
    nodeId: string,
  ) => DayStatistics["buildings"] extends Map<string, infer T>
    ? T | undefined
    : never;
}

const StatisticsContext = createContext<StatisticsContextType | undefined>(
  undefined,
);

export const StatisticsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [history, setHistory] = useState<DayStatistics[]>([]);

  const addDayStatistics = (stats: DayStatistics) => {
    setHistory((prev) => [...prev, stats]);
  };

  const currentDay =
    history.length > 0 ? history[history.length - 1].global.day : 0;

  const getLatestBuildingStats = (nodeId: string) => {
    if (history.length === 0) return undefined;
    const latestDay = history[history.length - 1];
    return latestDay.buildings.get(nodeId);
  };

  return (
    <StatisticsContext.Provider
      value={{
        history,
        addDayStatistics,
        currentDay,
        getLatestBuildingStats,
      }}
    >
      {children}
    </StatisticsContext.Provider>
  );
};

export const useStatistics = () => {
  const context = useContext(StatisticsContext);
  if (!context) {
    throw new Error("useStatistics must be used within a StatisticsProvider");
  }
  return context;
};

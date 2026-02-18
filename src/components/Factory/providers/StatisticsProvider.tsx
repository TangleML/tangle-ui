import React, { createContext, useContext, useState } from "react";

import type { DayStatistics, EdgeStatistics } from "../types/statistics";

interface StatisticsContextType {
  history: DayStatistics[];
  addDayStatistics: (stats: DayStatistics) => void;
  currentDay: number;
  getLatestBuildingStats: (
    nodeId: string,
  ) => DayStatistics["buildings"] extends Map<string, infer T>
    ? T | undefined
    : never;
  getLatestDayStats: () => DayStatistics | undefined;
  getLatestEdgeStats: (
    edgeId: string,
    includeBreakdown?: boolean,
  ) => EdgeStatistics[];
  resetStatistics: () => void;
  setStatisticsHistory: (history: DayStatistics[]) => void;
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

  const getLatestDayStats = () => {
    if (history.length === 0) return undefined;
    return history[history.length - 1];
  };

  /**
   * Get edge-specific transfer statistics
   * @param edgeId - The edge ID to get stats for
   * @param includeBreakdown - If true, also includes stats for "any" edge breakdown (e.g., "edge-123-berries")
   */
  const getLatestEdgeStats = (
    edgeId: string,
    includeBreakdown = false,
  ): EdgeStatistics[] => {
    if (history.length === 0) return [];
    const latestDay = history[history.length - 1];

    if (!includeBreakdown) {
      const stat = latestDay.edges.get(edgeId);
      return stat ? [stat] : [];
    }

    // For "any" edges, collect all stats that start with this edge ID
    const results: EdgeStatistics[] = [];
    latestDay.edges.forEach((stat, key) => {
      if (key === edgeId || key.startsWith(`${edgeId}-`)) {
        results.push(stat);
      }
    });

    return results;
  };

  const resetStatistics = () => {
    setHistory([]);
  };

  const setStatisticsHistory = (newHistory: DayStatistics[]) => {
    setHistory(newHistory);
  };

  return (
    <StatisticsContext.Provider
      value={{
        history,
        addDayStatistics,
        currentDay,
        getLatestBuildingStats,
        getLatestDayStats,
        getLatestEdgeStats,
        resetStatistics,
        setStatisticsHistory,
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

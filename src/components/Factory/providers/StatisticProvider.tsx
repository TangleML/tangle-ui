import { createContext, type ReactNode, useContext } from "react";

import type { DayStatistics } from "@/components/Factory/types/statistics";

interface StatisticsContextType {
  lastDayStats: DayStatistics | null;
  statsHistory: DayStatistics[];
}

const StatisticsContext = createContext<StatisticsContextType | undefined>(
  undefined,
);

interface StatisticsProviderProps {
  children: ReactNode;
  lastDayStats: DayStatistics | null;
  statsHistory: DayStatistics[];
}

export const StatisticsProvider = ({
  children,
  lastDayStats,
  statsHistory,
}: StatisticsProviderProps) => {
  return (
    <StatisticsContext.Provider value={{ lastDayStats, statsHistory }}>
      {children}
    </StatisticsContext.Provider>
  );
};

export const useStatistics = () => {
  const context = useContext(StatisticsContext);
  if (context === undefined) {
    throw new Error("useStatistics must be used within a StatisticsProvider");
  }
  return context;
};

import { createContext, type ReactNode, useContext } from "react";

import type { TourDefinition } from "@/components/Learn/tours/registry";

export interface TourModeValue {
  tour: TourDefinition;
  tempPipelineName: string;
}

const TourModeContext = createContext<TourModeValue | null>(null);

export function TourModeProvider({
  value,
  children,
}: {
  value: TourModeValue;
  children: ReactNode;
}) {
  return (
    <TourModeContext.Provider value={value}>
      {children}
    </TourModeContext.Provider>
  );
}

export function useTourMode(): TourModeValue | null {
  return useContext(TourModeContext);
}

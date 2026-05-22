import { createContext, type ReactNode, useContext } from "react";

import type { TourDefinition } from "@/components/Learn/tours/registry";

/**
 * Provided by the `/tour/$tourId` route. Editor components inside use
 * `useTourMode()` to detect tour mode and adapt their UI — e.g. show the
 * tour title instead of the pipeline storage key, hide actions that don't
 * make sense for a transient tour pipeline.
 */
export interface TourModeValue {
  tour: TourDefinition;
  /**
   * Storage key of the current temp pipeline backing this tour. The "Save
   * as new pipeline" action uses this to know what file to promote.
   */
  tempPipelineName: string;
  /**
   * Called after the temp pipeline has been promoted to a real pipeline
   * (renamed / saved-as). The route uses this to skip its on-unmount
   * delete and avoid clobbering the just-saved file.
   */
  markPipelinePromoted: () => void;
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

/** Returns the current tour-mode value, or null when not inside a tour. */
export function useTourMode(): TourModeValue | null {
  return useContext(TourModeContext);
}

import type { StepType } from "@reactour/tour";

import { navigatingEditorTour } from "./navigatingEditor.tour";

export type TourStep = StepType & {
  interaction?: "undock-window" | "redock-window" | "select-task";
  targetWindowId?: string;
  fallbackContent?: string;
};

export interface TourDefinition {
  id: string;
  displayName?: string;
  requiresEditor?: boolean;
  starterPipelineUrl?: string;
  steps: TourStep[];
}

const tours: TourDefinition[] = [navigatingEditorTour];

export function getTour(id: string): TourDefinition | undefined {
  return tours.find((tour) => tour.id === id);
}

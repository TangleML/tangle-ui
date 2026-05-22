import type { StepType } from "@reactour/tour";

import { publicAsset } from "@/utils/publicAsset";

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

const tourModules = import.meta.glob<TourDefinition>("./*.tour.json", {
  eager: true,
  import: "default",
});

const tours: TourDefinition[] = Object.values(tourModules).map((tour) => ({
  ...tour,
  starterPipelineUrl: tour.starterPipelineUrl
    ? publicAsset(tour.starterPipelineUrl)
    : undefined,
}));

export function getTour(id: string): TourDefinition | undefined {
  return tours.find((tour) => tour.id === id);
}

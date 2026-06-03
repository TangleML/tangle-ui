import type { StepType } from "@reactour/tour";

import type { TourAction } from "@/providers/TourProvider/tourActions";
import { publicAsset } from "@/utils/publicAsset";

export type TourStep = StepType &
  TourAction & {
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

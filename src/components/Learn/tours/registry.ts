import type { StepType } from "@reactour/tour";

import { publicAsset } from "@/utils/publicAsset";

export type TourStep = StepType & {
  interaction?:
    | "undock-window"
    | "redock-window"
    | "select-task"
    | "add-task"
    | "add-input"
    | "add-output"
    | "connect-edge"
    | "expand-folder"
    | "library-search"
    | "set-argument";
  targetWindowId?: string;
  targetFolderName?: string;
  targetArgumentName?: string;
  targetSearchTerm?: string;
  targetTaskName?: string;
  targetComponentName?: string;
  // targetTaskName / targetPortName are optional. When omitted, any new
  // binding from the source side counts (useful when the target is an IO
  // node with an auto-generated entity id we can't predict in JSON).
  targetEdge?: {
    sourceTaskName: string;
    sourcePortName: string;
    targetTaskName?: string;
    targetPortName?: string;
  };
  ringSelectors?: string[];
  resetLibrarySearch?: boolean;
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

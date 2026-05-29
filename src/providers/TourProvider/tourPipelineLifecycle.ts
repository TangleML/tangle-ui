import yaml from "js-yaml";

import type { TourDefinition } from "@/components/Learn/tours/registry";
import { defaultPipelineYamlWithName } from "@/utils/constants";

export const TOUR_PIPELINE_PREFIX = "__tour__";

export async function buildTourPipelineYaml(
  tour: TourDefinition,
  fallbackName: string,
): Promise<string> {
  const displayName = tour.displayName ?? fallbackName;

  if (!tour.starterPipelineUrl) {
    return defaultPipelineYamlWithName(displayName);
  }

  try {
    const response = await fetch(tour.starterPipelineUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch tour starter pipeline: ${response.status}`,
      );
    }
    const text = await response.text();
    const parsed = yaml.load(text) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Starter pipeline YAML is not an object");
    }
    return yaml.dump({ ...parsed, name: displayName });
  } catch (error) {
    console.warn("Falling back to empty tour pipeline:", error);
    return defaultPipelineYamlWithName(displayName);
  }
}

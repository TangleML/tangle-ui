import yaml from "js-yaml";

import type { TourDefinition } from "@/components/Learn/tours/registry";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { defaultPipelineYamlWithName } from "@/utils/constants";

export const TOUR_PIPELINE_PREFIX = "__tour__";

export async function deleteTourPipelineByName(
  storage: PipelineStorageService,
  name: string,
): Promise<void> {
  try {
    const file = await storage.resolvePipelineByName(name);
    if (file) await file.deleteFile();
  } catch (error) {
    console.warn(`Failed to delete tour pipeline "${name}":`, error);
  }
}

/**
 * Promote a tour pipeline (`__tour__...`) to a human-readable storage key.
 * If the desired name is taken, falls back to `${desiredName} (2)`, then `(3)`,
 * etc. If the pipeline has already been renamed by the user (no `__tour__`
 * prefix), it's left alone.
 *
 * Returns the final storage key (unchanged if no rename happened).
 */
export async function promoteTourPipelineName(
  storage: PipelineStorageService,
  currentName: string,
  desiredName: string,
): Promise<{ newName: string; renamed: boolean }> {
  if (!currentName.startsWith(TOUR_PIPELINE_PREFIX)) {
    return { newName: currentName, renamed: false };
  }

  try {
    const file = await storage.resolvePipelineByName(currentName);
    if (!file) return { newName: currentName, renamed: false };

    let candidate = desiredName;
    let counter = 2;
    while (await storage.rootFolder.findFile(candidate)) {
      candidate = `${desiredName} (${counter})`;
      counter++;
    }

    await file.rename(candidate);
    return { newName: candidate, renamed: true };
  } catch (error) {
    console.warn(`Failed to promote tour pipeline "${currentName}":`, error);
    return { newName: currentName, renamed: false };
  }
}

export async function cleanupOrphanTourPipelines(
  storage: PipelineStorageService,
  keep?: string | null,
): Promise<void> {
  try {
    const files = await storage.rootFolder.listPipelines();
    const orphans = files.filter(
      (f) =>
        f.storageKey.startsWith(TOUR_PIPELINE_PREFIX) && f.storageKey !== keep,
    );
    await Promise.all(orphans.map((f) => f.deleteFile()));
  } catch (error) {
    console.warn("Failed to cleanup orphan tour pipelines:", error);
  }
}

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

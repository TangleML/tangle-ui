import type { PipelineFile } from "./PipelineFile";
import {
  getPipelineStorageService,
  PipelineNotFoundError,
} from "./PipelineStorageService";
import type { PipelineRef } from "./types";

export async function listPipelineFiles(): Promise<PipelineFile[]> {
  return getPipelineStorageService().rootFolder.listPipelines();
}

/**
 * The read path for callers that treat "no such pipeline" as an ordinary
 * answer. Anything else — an unreachable store, an ambiguous name — still
 * throws, because those need saying out loud rather than rendering as empty.
 */
export async function findPipelineFile(
  ref: PipelineRef,
): Promise<PipelineFile | undefined> {
  try {
    return await getPipelineStorageService().resolve(ref);
  } catch (error) {
    if (error instanceof PipelineNotFoundError) return undefined;
    throw error;
  }
}

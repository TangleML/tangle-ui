import type { PipelineFile } from "./PipelineFile";
import type { PipelineFileSource } from "./pipelineFileEvents";
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

export async function createPipeline(
  name: string,
  content: string,
): Promise<PipelineFile> {
  return getPipelineStorageService().createPipeline(name, content);
}

export async function savePipeline(
  name: string,
  content: string,
  source?: PipelineFileSource,
): Promise<PipelineFile> {
  return getPipelineStorageService().savePipelineByName(name, content, source);
}

export async function renamePipeline(
  currentName: string,
  newName: string,
  content: string,
  source?: PipelineFileSource,
): Promise<PipelineFile> {
  return getPipelineStorageService().renamePipelineByName(
    currentName,
    newName,
    content,
    source,
  );
}

export async function deletePipelineByName(name: string): Promise<void> {
  return getPipelineStorageService().deletePipelineByName(name);
}

import type { ComponentSpecJson } from "../src/models/componentSpec/entities/types";
import type { CollabStorageMode } from "../src/services/collaboration/serverInfo";
import { fetchPipeline, writePipeline } from "./pipelineApi";

export interface StoredPipeline {
  storageKey: string;
  spec: ComponentSpecJson;
}

export interface PipelineRepository {
  readonly mode: CollabStorageMode;
  load(roomId: string): Promise<StoredPipeline | null>;
  save(storageKey: string, spec: ComponentSpecJson): Promise<void>;
}

export class BackendPipelineRepository implements PipelineRepository {
  readonly mode = "backend";

  async load(roomId: string): Promise<StoredPipeline | null> {
    const pipeline = await fetchPipeline(roomId);
    return pipeline
      ? { storageKey: pipeline.filePath, spec: pipeline.spec }
      : null;
  }

  save(storageKey: string, spec: ComponentSpecJson): Promise<void> {
    return writePipeline(storageKey, spec);
  }
}

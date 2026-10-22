import {
  getPipelineDocument,
  type SavedPipelineDocument,
} from "@/services/pipelineSpecService";
import { componentSpecToYaml } from "@/utils/yaml";

import type {
  PipelineFileDescriptor,
  PipelineStorageDriver,
  RemotePipelineRef,
} from "../types";

export class RemotePipelineStorageDriver implements PipelineStorageDriver {
  readonly type = "remote-pipeline";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  private constructor(
    readonly backendUrl: string,
    readonly pipelineId: string,
    private readonly pipeline: SavedPipelineDocument,
  ) {}

  get name(): string {
    return (
      this.pipeline.root_pipeline_task.componentRef.spec.name ??
      this.pipeline.file_path
    );
  }

  static async open(
    ref: RemotePipelineRef,
  ): Promise<RemotePipelineStorageDriver> {
    return new RemotePipelineStorageDriver(
      ref.backendUrl,
      ref.pipelineId,
      await getPipelineDocument(ref.pipelineId, ref.backendUrl),
    );
  }

  async list(): Promise<PipelineFileDescriptor[]> {
    return [{ storageKey: this.name }];
  }

  async read(_storageKey: string): Promise<string> {
    return componentSpecToYaml(
      this.pipeline.root_pipeline_task.componentRef.spec,
    );
  }

  async write(_storageKey: string, _content: string): Promise<void> {
    throw new Error("Remote pipelines are read-only.");
  }

  async rename(_oldStorageKey: string, _newStorageKey: string): Promise<void> {
    throw new Error("Remote pipelines are read-only.");
  }

  async delete(_storageKey: string): Promise<void> {
    throw new Error("Remote pipelines are read-only.");
  }

  async hasKey(storageKey: string): Promise<boolean> {
    return storageKey === this.name;
  }
}

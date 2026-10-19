import { defaultPipelineYamlWithName } from "@/utils/constants";
import { componentSpecFromYaml } from "@/utils/yaml";

import type {
  PipelineFileDescriptor,
  PipelineStorageDriver,
  RemotePipelineDraftRef,
  RemotePipelineRef,
} from "../types";
import { RemotePipelineStorageDriver } from "./RemotePipelineStorageDriver";

/** An in-memory document; only its first write creates a server record. */
export class RemotePipelineDraftStorageDriver implements PipelineStorageDriver {
  readonly type = "remote-pipeline-draft";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  readonly canEdit = true;
  private remote?: RemotePipelineStorageDriver;
  private pending: Promise<void> = Promise.resolve();
  private notified = false;

  get remoteRef(): RemotePipelineRef | undefined {
    return (
      this.remote && {
        source: "remote",
        backendUrl: this.ref.backendUrl,
        pipelineId: this.remote.pipelineId,
      }
    );
  }

  constructor(
    private ref: RemotePipelineDraftRef,
    private onCreated: (
      remote: RemotePipelineRef,
    ) => void | Promise<void> = () => {},
  ) {}

  async list(): Promise<PipelineFileDescriptor[]> {
    return [];
  }

  async read(storageKey: string): Promise<string> {
    return this.remote
      ? this.remote.read(storageKey)
      : defaultPipelineYamlWithName(this.ref.name, {
          provisionalName: this.ref.provisionalName,
        });
  }

  write(storageKey: string, content: string): Promise<void> {
    // Keep the same path across failures, including a lost creation response.
    // Serialize all writes, even ones queued while creation is in flight.
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        if (this.remote) {
          await this.remote.write(storageKey, content);
        } else {
          this.remote = await RemotePipelineStorageDriver.create(
            this.ref.backendUrl,
            componentSpecFromYaml(content).name ?? this.ref.name,
            content,
            `pipelines/${this.ref.draftId}.yaml`,
          );
        }
        if (!this.notified) {
          await this.onCreated(this.remoteRef!);
          this.notified = true;
        }
      });
    return this.pending;
  }

  async rename(_oldStorageKey: string, _newStorageKey: string): Promise<void> {
    // The editor changes spec.name and autosave persists that content.
  }

  async delete(_storageKey: string): Promise<void> {
    throw new Error("Pipeline deletion is not supported in this editor.");
  }

  async hasKey(_storageKey: string): Promise<boolean> {
    return false;
  }
}

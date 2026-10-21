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
  private savedContent?: string;
  private readonly filePath = `pipelines/${crypto.randomUUID()}.yaml`;

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
        if (this.remote && (this.notified || content !== this.savedContent)) {
          await this.remote.write(storageKey, content);
        } else if (!this.remote) {
          this.remote = await RemotePipelineStorageDriver.create(
            this.ref.backendUrl,
            componentSpecFromYaml(content).name ?? this.ref.name,
            content,
            this.filePath,
          );
        }
        this.savedContent = content;
        if (!this.notified) {
          await this.onCreated({
            source: "remote",
            backendUrl: this.ref.backendUrl,
            pipelineId: this.remote.pipelineId,
          });
          this.notified = true;
        }
      });
    return this.pending;
  }

  async copy(
    name: string,
    content: string,
  ): Promise<RemotePipelineStorageDriver> {
    await this.pending.catch(() => {});
    if (!this.remote)
      throw new Error("Save the pipeline before making a remote copy.");
    return this.remote.copy(name, content);
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

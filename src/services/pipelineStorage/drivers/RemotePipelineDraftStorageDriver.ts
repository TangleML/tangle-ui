import { defaultPipelineYamlWithName } from "@/utils/constants";

import {
  admitRemotePipelineWrite,
  type RemotePipelineWriteAdmission,
} from "../remotePipelineDeletion";
import type {
  PipelineFileDescriptor,
  PipelineStorageDriver,
  RemotePipelineDraftRef,
  RemotePipelineRef,
} from "../types";
import type { RemotePipelineStorageDriver } from "./RemotePipelineStorageDriver";

const pendingDraftWrites = new Map<string, Promise<void>>();

export async function waitForPendingRemotePipelineDraftWrites(
  backendUrl: string,
  filePath: string,
): Promise<void> {
  const key = JSON.stringify([backendUrl, filePath]);
  while (pendingDraftWrites.has(key)) {
    await pendingDraftWrites.get(key);
  }
}

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

  get ownerId(): string | undefined {
    return this.remote?.ownerId;
  }

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
    private filePath: string,
    private createRemote: (
      content: string,
      admission: RemotePipelineWriteAdmission,
    ) => Promise<RemotePipelineStorageDriver>,
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
    return this.enqueue(async (admission) => {
      if (this.remote && (this.notified || content !== this.savedContent)) {
        await this.remote.write(storageKey, content, admission);
      } else if (!this.remote) {
        this.remote = await this.createRemote(content, admission);
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
  }

  rename(oldStorageKey: string, newStorageKey: string): Promise<void> {
    return this.enqueue(async (admission) => {
      if (this.remote) {
        await this.remote.rename(oldStorageKey, newStorageKey, admission);
      } else {
        this.ref = { ...this.ref, name: newStorageKey };
      }
    });
  }

  private async enqueue(
    operation: (admission: RemotePipelineWriteAdmission) => Promise<void>,
  ): Promise<void> {
    const admission = admitRemotePipelineWrite(
      this.ref.backendUrl,
      this.remote ?? { filePath: this.filePath },
    );
    this.pending = this.pending
      .catch(() => {})
      .then(() => {
        admission.assertWritable();
        return operation(admission);
      });
    const key = JSON.stringify([this.ref.backendUrl, this.filePath]);
    // The outer draft queue must not join the remote write queue it awaits.
    const settled = this.pending
      .catch(() => {})
      .finally(() => {
        if (pendingDraftWrites.get(key) === settled)
          pendingDraftWrites.delete(key);
      });
    pendingDraftWrites.set(key, settled);
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

  async delete(_storageKey: string): Promise<void> {
    throw new Error("Pipeline deletion is not supported in this editor.");
  }

  async hasKey(_storageKey: string): Promise<boolean> {
    return false;
  }
}

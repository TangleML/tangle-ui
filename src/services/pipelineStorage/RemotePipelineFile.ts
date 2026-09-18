import yaml from "js-yaml";
import { action, observable, runInAction } from "mobx";

import type { CloudPipelineSummary } from "@/services/cloudPipelineService";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

import { PipelineFile } from "./PipelineFile";
import type { PipelineFolder } from "./PipelineFolder";
import {
  type RemotePipelineRecovery,
  remotePipelineReference,
} from "./remotePipelineRecovery";
import type { RemotePipelineStore } from "./RemotePipelineStore";

export class RemotePipelineFile extends PipelineFile {
  @observable.ref accessor recovery: RemotePipelineRecovery;
  private pendingWrites = observable.box(0);

  constructor(
    readonly store: RemotePipelineStore,
    folder: PipelineFolder,
    recovery: RemotePipelineRecovery,
    readonly summary?: CloudPipelineSummary,
  ) {
    const pipeline = recovery.pipeline ?? summary;
    super({
      id: pipeline
        ? remotePipelineReference(store.backendUrl, pipeline.id)
        : recovery.key,
      storageKey: recovery.displayName,
      folder,
      createdAt: summary ? new Date(summary.created_at) : undefined,
      modifiedAt: new Date(recovery.modifiedAt),
    });
    this.recovery = recovery;
  }

  override get canEdit(): boolean {
    const pipeline = this.recovery.pipeline ?? this.summary;
    const account = this.store.account;
    return pipeline
      ? account
        ? account.id === pipeline.user_id &&
          account.permissions.includes("write")
        : this.recovery.ownerId === pipeline.user_id
      : !account || account.permissions.includes("write");
  }

  override get displayName(): string {
    return this.recovery.displayName;
  }
  override get referenceId(): string {
    const pipeline = this.recovery.pipeline ?? this.summary;
    return pipeline
      ? remotePipelineReference(this.store.backendUrl, pipeline.id)
      : this.recovery.key;
  }
  override get storageKind(): "remote" | "pending" {
    return this.recovery.pipeline || this.summary ? "remote" : "pending";
  }
  override get saveError(): string | undefined {
    return (
      this.recovery.error ??
      (this.recovery.dirty ? "Not saved to server" : undefined)
    );
  }
  override get isSaving(): boolean {
    return this.pendingWrites.get() > 0;
  }

  @action setRecovery(recovery: RemotePipelineRecovery) {
    this.recovery = recovery;
    this.storageKey = recovery.displayName;
  }

  override async read(): Promise<string> {
    return this.store.read(this);
  }
  override async persistRecovery(content: string): Promise<void> {
    await this.store.stage(this, content);
  }
  override async write(content: string): Promise<void> {
    await this.persistRecovery(content);
    await this.retry();
  }
  override async retry(): Promise<void> {
    runInAction(() => {
      this.pendingWrites.set(this.pendingWrites.get() + 1);
    });
    try {
      await this.store.flush(this);
      emitUserPipelineWritten();
    } finally {
      runInAction(() => {
        this.pendingWrites.set(this.pendingWrites.get() - 1);
      });
    }
  }
  override async rename(newName: string): Promise<void> {
    const content = yaml.load(await this.read(), PIPELINE_YAML_LOAD_OPTIONS);
    if (!isValidComponentSpec(content))
      throw new Error("Invalid pipeline definition.");
    content.name = newName;
    await this.write(yaml.dump(content));
  }
  override async moveTo(): Promise<void> {
    throw new Error("Remote pipelines cannot be moved into local folders.");
  }
  override async deleteFile(): Promise<void> {
    await this.store.delete(this);
  }
}

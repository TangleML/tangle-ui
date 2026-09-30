import { action, observable, runInAction } from "mobx";

import { getCloudPipelineSavedTaskArguments } from "@/services/cloudPipelineService";
import type { ArgumentType } from "@/utils/componentSpec";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import type { RemotePipelineDescriptor } from "./drivers/RemotePipelineStorageDriver";
import { PipelineFile } from "./PipelineFile";
import type { PipelineFolder } from "./PipelineFolder";
import type { RemotePipelineRecovery } from "./remotePipelineRecovery";
import type { RemotePipelineStore } from "./RemotePipelineStore";

export class RemotePipelineFile extends PipelineFile {
  @observable.ref accessor recovery: RemotePipelineRecovery;
  @observable.ref accessor descriptor: RemotePipelineDescriptor | undefined;
  private pendingWrites = observable.box(0);

  constructor(
    readonly store: RemotePipelineStore,
    folder: PipelineFolder,
    recovery: RemotePipelineRecovery,
    descriptor: RemotePipelineDescriptor | undefined = recovery.pipeline
      ? store.driver.describe(recovery.pipeline)
      : undefined,
  ) {
    super({
      ...descriptor,
      id: descriptor?.id ?? recovery.key,
      storageKey: descriptor?.storageKey ?? recovery.key,
      folder,
      modifiedAt: new Date(recovery.modifiedAt),
    });
    this.recovery = recovery;
    this.descriptor = descriptor;
  }

  override get canEdit(): boolean {
    const pipeline = this.recovery.pipeline ?? this.descriptor?.pipeline;
    const account = this.store.account;
    return pipeline
      ? account
        ? this.store.driver.describe(pipeline).canEdit
        : this.recovery.ownerId === pipeline.user_id
      : !account || account.permissions.includes("write");
  }

  override get displayName(): string {
    return this.recovery.displayName;
  }
  override get referenceId(): string {
    return this.descriptor?.storageKey ?? this.recovery.key;
  }
  override get storageKind(): "remote" | "pending" {
    return this.descriptor ? "remote" : "pending";
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
  override get savedTaskArguments(): Record<string, ArgumentType> {
    return this.recovery.pipeline
      ? getCloudPipelineSavedTaskArguments(this.recovery.pipeline)
      : {};
  }

  @action setRecovery(recovery: RemotePipelineRecovery) {
    this.recovery = recovery;
    if (recovery.pipeline)
      this.descriptor = this.store.driver.describe(recovery.pipeline);
    this.storageKey = this.referenceId;
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
    const content = componentSpecFromYaml(await this.read());
    content.name = newName;
    await this.write(componentSpecToYaml(content));
  }
  override async moveTo(): Promise<void> {
    throw new Error("Remote pipelines cannot be moved into local folders.");
  }
  override async deleteFile(): Promise<void> {
    await this.store.delete(this);
  }
}

import { action, makeObservable, observable, runInAction } from "mobx";

import { getCloudPipelineSavedTaskArguments } from "@/services/cloudPipelineService";
import type { ArgumentType } from "@/utils/componentSpec";
import { getErrorMessage } from "@/utils/string";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import type {
  RemotePipelineDescriptor,
  RemotePipelineStorageDriver,
} from "./drivers/RemotePipelineStorageDriver";
import { migratePipelineReferences } from "./migratePipelineReferences";
import { emitPipelineFileChanged } from "./pipelineFileEvents";
import type { PipelineFolder } from "./PipelineFolder";
import { withPipelineLock } from "./pipelineLock";
import { deleteEntry, updateEntry } from "./pipelineRegistry";
import {
  assertLocalPipelineVisible,
  assertNotDeleted,
  createRecovery,
  mergeRecovery,
  parseRemotePipelineReference,
  recoveryKey,
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
  stageRecovery,
} from "./remotePipelineRecovery";
import type { PipelineFileDescriptor, PipelineStorageDriver } from "./types";

export interface RemotePipelineStorage {
  driver: RemotePipelineStorageDriver;
  scope: string;
}

interface PipelineFileInit extends PipelineFileDescriptor {
  id: string;
  folder: PipelineFolder;
  remote?: RemotePipelineStorage;
  recovery?: RemotePipelineRecovery;
  descriptor?: RemotePipelineDescriptor;
  remoteReference?: string;
}

export class PipelineFile {
  readonly id: string;
  @observable accessor createdAt: Date | undefined;
  @observable accessor modifiedAt: Date | undefined;
  @observable accessor storageKey: string;
  @observable.ref accessor folder: PipelineFolder;
  @observable.ref accessor driver: PipelineStorageDriver;
  @observable.ref accessor recovery: RemotePipelineRecovery | undefined;
  @observable.ref accessor descriptor: RemotePipelineDescriptor | undefined;
  @observable.ref private accessor remoteStorage:
    RemotePipelineStorage | undefined;
  private readonly remoteReference?: string;
  @observable private accessor fileDisplayName: string | undefined;
  @observable private accessor pendingWrites = 0;
  @observable.ref private accessor savedAt: Date | null = null;
  @observable private accessor editable: boolean;
  @observable private accessor writeError: string | undefined;

  constructor(options: PipelineFileInit) {
    this.id = options.id;
    this.storageKey = options.storageKey;
    this.folder = options.folder;
    this.driver =
      options.remoteReference && options.remote
        ? options.remote.driver
        : options.folder.driver;
    this.remoteReference = options.remoteReference;
    this.remoteStorage = options.remote;
    this.fileDisplayName = options.displayName;
    this.editable = options.canEdit ?? true;
    this.createdAt = options.createdAt;
    this.modifiedAt = options.modifiedAt;
    this.recovery = options.recovery;
    this.descriptor = options.descriptor;
    makeObservable(this);
    if (options.recovery) this.acceptRecovery(options.recovery);
  }

  get canEdit(): boolean {
    if (!this.remoteStorage || this.storageKind === "local")
      return this.editable;
    const pipeline = this.descriptor?.pipeline;
    const account = this.remoteStorage.driver.account;
    if (!pipeline)
      return (
        !this.remoteId && (!account || account.permissions.includes("write"))
      );
    return account
      ? this.remoteStorage.driver.describe(pipeline).canEdit
      : this.recovery?.ownerId === pipeline.user_id;
  }

  get storageKind(): "local" | "remote" | "pending" {
    if (this.driver.type !== "remote") return "local";
    return this.remoteId ? "remote" : "pending";
  }

  get displayName(): string {
    return (
      this.recovery?.displayName ?? this.fileDisplayName ?? this.storageKey
    );
  }

  get referenceId(): string {
    if (this.storageKind === "local") return this.storageKey;
    return (
      this.descriptor?.storageKey ??
      this.remoteReference ??
      this.recovery?.key ??
      this.storageKey
    );
  }

  get remoteId(): string | undefined {
    return this.driver.type === "remote"
      ? (this.descriptor?.pipeline.id ??
          (this.remoteReference
            ? parseRemotePipelineReference(this.remoteReference)?.pipelineId
            : undefined))
      : undefined;
  }

  get remoteBackendUrl(): string | undefined {
    return this.remoteId ? this.remoteStorage?.driver.backendUrl : undefined;
  }

  get saveError(): string | undefined {
    return (
      this.writeError ??
      this.recovery?.error ??
      (this.recovery?.dirty ? "Not saved to server" : undefined)
    );
  }

  get lastWriteError(): string | undefined {
    return this.writeError ?? this.recovery?.error;
  }

  get isSaving(): boolean {
    return this.pendingWrites > 0;
  }

  get lastSavedAt(): Date | null {
    return this.savedAt;
  }

  get savedTaskArguments(): Record<string, ArgumentType> {
    return this.recovery?.pipeline
      ? getCloudPipelineSavedTaskArguments(this.recovery.pipeline)
      : {};
  }

  @action
  enableRemoteStorage(remote: RemotePipelineStorage): void {
    this.remoteStorage = remote;
  }

  restoreRecovery(record: RemotePipelineRecovery): void {
    this.acceptRecovery(record);
  }

  @action
  private acceptRecovery(record: RemotePipelineRecovery): void {
    const current = this.recovery;
    if (current?.deleted || (current?.revision ?? 0) > (record.revision ?? 0))
      return;
    this.recovery = record;
    this.modifiedAt = new Date(record.modifiedAt);
    const pipeline = record.pipeline ?? record.summary;
    if (pipeline && this.remoteStorage) {
      this.descriptor = this.remoteStorage.driver.describe(pipeline);
      this.createdAt = this.descriptor.createdAt;
    }
    if (this.remoteStorage && (!record.localFileId || record.migrated)) {
      this.driver = this.remoteStorage.driver;
      this.storageKey = this.descriptor?.storageKey ?? record.key;
    }
  }

  private assertEditable(): void {
    if (!this.canEdit)
      throw new Error(
        this.remoteStorage
          ? "Only the owner can change this remote pipeline. This pipeline is read-only."
          : "This pipeline is read-only.",
      );
  }

  private initialRecovery(content: string): RemotePipelineRecovery {
    if (!this.remoteStorage)
      throw new Error("Remote pipelines are not enabled.");
    if (this.recovery) return this.recovery;
    if (this.remoteId)
      return {
        key: `remote:${encodeURIComponent(this.remoteStorage.scope)}:${this.remoteId}`,
        documentId: this.id,
        scope: this.remoteStorage.scope,
        filePath: "",
        displayName: this.displayName,
        content,
        dirty: false,
        modifiedAt: Date.now(),
      };
    return {
      key: recoveryKey(
        this.remoteStorage.scope,
        `pipeline-studio/${this.id}.yaml`,
      ),
      documentId: this.id,
      scope: this.remoteStorage.scope,
      filePath: `pipeline-studio/${this.id}.yaml`,
      displayName: this.displayName,
      content,
      dirty: true,
      modifiedAt: Date.now(),
      localFileId: this.id,
      localStorageKey: this.storageKey,
    };
  }

  private async latestRecovery(): Promise<RemotePipelineRecovery | undefined> {
    if (!this.remoteStorage) return undefined;
    const initial = this.initialRecovery("");
    const record = await remotePipelineRecoveryDb.copies.get(initial.key);
    if (record) {
      assertNotDeleted(record);
      this.acceptRecovery(record);
    }
    return record ?? this.recovery;
  }

  async read(): Promise<string> {
    const record = await this.latestRecovery();
    if (this.driver.type !== "remote")
      await assertLocalPipelineVisible(this.id);
    if (record?.dirty) return record.content;
    if (this.driver.type !== "remote") {
      const result = await this.driver.read(this.storageKey);
      if (typeof result === "string") return result;
      await this.acceptDescriptor(result.descriptor);
      return result.content;
    }
    if (!this.remoteStorage || !this.remoteId) return record?.content ?? "";
    const snapshot = this.initialRecovery("");
    const loaded = await this.remoteStorage.driver.read(this.referenceId);
    const updated: RemotePipelineRecovery = {
      ...snapshot,
      content: loaded.content,
      filePath: loaded.descriptor.pipeline.file_path,
      dirty: false,
      displayName: loaded.descriptor.displayName,
      pipeline: loaded.descriptor.pipeline,
      summary: undefined,
      ownerId: loaded.descriptor.canEdit
        ? loaded.descriptor.pipeline.user_id
        : undefined,
      modifiedAt: loaded.descriptor.modifiedAt.getTime(),
    };
    const accepted =
      loaded.descriptor.pipeline.user_id ===
      this.remoteStorage.driver.account?.id
        ? await mergeRecovery(updated)
        : updated;
    assertNotDeleted(accepted);
    this.acceptRecovery(accepted);
    return accepted.content;
  }

  async persistRecovery(content: string): Promise<void> {
    this.assertEditable();
    if (!this.remoteStorage) return;
    try {
      await this.latestRecovery();
      if (this.storageKind === "local")
        await assertLocalPipelineVisible(this.id);
      const initial = this.initialRecovery(content);
      this.acceptRecovery(
        await stageRecovery(
          {
            ...initial,
            localStorageKey:
              this.storageKind === "local"
                ? this.storageKey
                : initial.localStorageKey,
          },
          content,
        ),
      );
    } catch (error) {
      runInAction(() => {
        this.writeError = getErrorMessage(error);
      });
      throw error;
    }
  }

  async write(content: string): Promise<void> {
    this.assertEditable();
    if (this.remoteStorage) {
      await this.persistRecovery(content);
      await this.retry();
      return;
    }
    runInAction(() => {
      this.pendingWrites += 1;
    });
    try {
      await withPipelineLock(this.id, async () => {
        await assertLocalPipelineVisible(this.id);
        const saved = await this.driver.write(this.storageKey, content);
        if (saved) await this.acceptDescriptor(saved);
      });
      runInAction(() => {
        this.savedAt = new Date();
        this.writeError = undefined;
      });
      this.emitWritten();
    } catch (error) {
      runInAction(() => {
        this.writeError = getErrorMessage(error);
      });
      throw error;
    } finally {
      runInAction(() => {
        this.pendingWrites -= 1;
      });
    }
  }

  async retry(): Promise<void> {
    this.assertEditable();
    if (!this.remoteStorage) return;
    const initial = this.initialRecovery("");
    if (!(await this.latestRecovery())) {
      const content = await this.read();
      this.acceptRecovery(await createRecovery({ ...initial, content }));
    }
    const remote = this.remoteStorage;
    runInAction(() => {
      this.pendingWrites += 1;
    });
    try {
      await withPipelineLock(initial.key, async () => {
        let record = (await this.latestRecovery()) ?? initial;
        assertNotDeleted(record);
        if (!record.dirty && (!record.localFileId || record.migrated)) return;
        try {
          if (record.dirty || !record.pipeline) {
            const existing = record.pipeline ?? record.summary;
            const saved = await remote.driver.write(
              existing
                ? remotePipelineReference(remote.driver.backendUrl, existing.id)
                : record.filePath,
              record.content,
              {
                existing: existing
                  ? remote.driver.describe(existing)
                  : undefined,
                source: record.cloneSource
                  ? remote.driver.describe(record.cloneSource)
                  : undefined,
              },
            );
            // Confirm the locator before moving browser references; retry then updates the same server object.
            record = await mergeRecovery({
              ...record,
              pipeline: saved.pipeline,
              summary: undefined,
              cloneSource: undefined,
              ownerId: saved.pipeline.user_id,
              displayName: saved.displayName,
              dirty: false,
              error: undefined,
            });
          }
          assertNotDeleted(record);
          if (!record.migrated && record.pipeline) {
            await migratePipelineReferences(
              record.localStorageKey ?? record.key,
              remotePipelineReference(
                remote.driver.backendUrl,
                record.pipeline.id,
              ),
              record.displayName,
              this.id,
            );
            record = await mergeRecovery({ ...record, migrated: true });
          }
          this.acceptRecovery(record);
          runInAction(() => {
            this.savedAt = new Date();
            this.writeError = undefined;
          });
        } catch (error) {
          this.acceptRecovery(
            await mergeRecovery({
              ...record,
              dirty: true,
              error: getErrorMessage(error),
            }),
          );
          throw error;
        }
      });
      this.emitWritten();
    } finally {
      runInAction(() => {
        this.pendingWrites -= 1;
      });
    }
  }

  async rename(newName: string): Promise<void> {
    this.assertEditable();
    const key = this.remoteStorage ? this.initialRecovery("").key : this.id;
    const remote = await withPipelineLock(key, async () => {
      await this.latestRecovery();
      this.assertEditable();
      if (this.driver.type === "remote") return true;
      await assertLocalPipelineVisible(this.id);
      const saved = await this.driver.rename(this.storageKey, newName);
      await this.acceptDescriptor(
        saved ?? { storageKey: newName, displayName: newName },
      );
      if (this.recovery) {
        let content = this.recovery.content;
        try {
          const spec = componentSpecFromYaml(content);
          spec.name = newName;
          content = componentSpecToYaml(spec);
        } catch {
          // An unfinished YAML edit remains recoverable even if its local file is renamed.
        }
        this.acceptRecovery(
          await stageRecovery(
            {
              ...this.recovery,
              displayName: newName,
              localStorageKey: this.storageKey,
            },
            content,
          ),
        );
      }
      return false;
    });
    if (remote) {
      const spec = componentSpecFromYaml(await this.read());
      spec.name = newName;
      await this.write(componentSpecToYaml(spec));
    }
  }

  async moveTo(targetFolder: PipelineFolder): Promise<void> {
    this.assertEditable();
    const key = this.remoteStorage ? this.initialRecovery("").key : this.id;
    await withPipelineLock(key, async () => {
      await this.latestRecovery();
      this.assertEditable();
      if (!this.driver.allowsMoveOut)
        throw new Error(
          `Cannot move files out of folder "${this.folder.name}"`,
        );
      if (!targetFolder.canAcceptFiles)
        throw new Error(
          `Folder "${targetFolder.name}" does not accept moved files`,
        );
      await updateEntry(this.id, { folderId: targetFolder.id });
      runInAction(() => {
        this.folder = targetFolder;
        this.driver = targetFolder.driver;
      });
    });
  }

  async deleteFile(): Promise<void> {
    this.assertEditable();
    const initial = this.remoteStorage ? this.initialRecovery("") : undefined;
    await withPipelineLock(initial?.key ?? this.id, async () => {
      const record = await this.latestRecovery();
      if (this.remoteStorage && record) {
        const saved = record.pipeline ?? record.summary;
        await this.remoteStorage.driver.delete(
          saved
            ? remotePipelineReference(
                this.remoteStorage.driver.backendUrl,
                saved.id,
              )
            : record.filePath,
          saved ? this.remoteStorage.driver.describe(saved) : undefined,
        );
      }
      if (!record || (record.localFileId && !record.migrated)) {
        await assertLocalPipelineVisible(this.id);
        await this.driver.delete(this.storageKey);
        await deleteEntry(this.id);
      }
      if (record) {
        const tombstone = {
          ...record,
          deleted: true,
          dirty: false,
          error: undefined,
        };
        await remotePipelineRecoveryDb.copies.put(tombstone);
        this.acceptRecovery(tombstone);
      }
      emitUserPipelineWritten();
    });
  }

  private async acceptDescriptor(
    descriptor: PipelineFileDescriptor,
  ): Promise<void> {
    if (descriptor.storageKey !== this.storageKey)
      await updateEntry(this.id, { storageKey: descriptor.storageKey });
    runInAction(() => {
      this.storageKey = descriptor.storageKey;
      this.fileDisplayName = descriptor.displayName ?? this.fileDisplayName;
      this.createdAt = descriptor.createdAt ?? this.createdAt;
      this.modifiedAt = descriptor.modifiedAt ?? this.modifiedAt;
      this.editable = descriptor.canEdit ?? this.editable;
    });
  }

  private emitWritten(): void {
    emitPipelineFileChanged({ storageKey: this.storageKey, source: "v2" });
    emitUserPipelineWritten();
  }
}

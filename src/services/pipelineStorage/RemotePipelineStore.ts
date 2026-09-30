import { observable, runInAction } from "mobx";

import type {
  CloudConnection,
  CloudPipelineSummary,
} from "@/services/cloudPipelineService";
import { getErrorMessage } from "@/utils/string";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import {
  type RemotePipelineDescriptor,
  RemotePipelineStorageDriver,
} from "./drivers/RemotePipelineStorageDriver";
import { migratePipelineReferences } from "./migratePipelineReferences";
import type { PipelineFile } from "./PipelineFile";
import type { PipelineFolder } from "./PipelineFolder";
import { withPipelineLock } from "./pipelineLock";
import { RemotePipelineFile } from "./RemotePipelineFile";
import {
  parseRemotePipelineReference,
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "./remotePipelineRecovery";
import type { PipelinePageOptions, PipelineStoragePage } from "./types";

export interface RemotePipelineOptions {
  connection: CloudConnection;
  scope: string;
}

export class RemotePipelineStore {
  @observable accessor listError: string | undefined;
  readonly driver: RemotePipelineStorageDriver;

  constructor(
    readonly options: RemotePipelineOptions,
    readonly folder: PipelineFolder,
  ) {
    this.driver = new RemotePipelineStorageDriver(options.connection);
  }

  get account() {
    return this.driver.account;
  }

  get backendUrl(): string {
    return this.driver.backendUrl;
  }
  get scope(): string {
    return this.options.scope;
  }

  private recoveryKey(filePath: string): string {
    return `pending:${encodeURIComponent(this.scope)}:${encodeURIComponent(filePath)}`;
  }

  private summaryRecoveryKey(summary: CloudPipelineSummary): string {
    return summary.user_id === this.account?.id
      ? this.recoveryKey(summary.file_path)
      : remotePipelineReference(this.backendUrl, summary.id);
  }

  async records(): Promise<RemotePipelineRecovery[]> {
    return remotePipelineRecoveryDb.copies
      .where("scope")
      .equals(this.scope)
      .toArray();
  }

  async listPage(
    options: PipelinePageOptions = {},
  ): Promise<PipelineStoragePage<RemotePipelineFile>> {
    options.signal?.throwIfAborted();
    const [page, records] = await Promise.all([
      this.driver.listPage(options),
      this.records(),
    ]);
    options.signal?.throwIfAborted();
    return {
      ...page,
      files: this.filesFromDescriptors(page.files, records),
    };
  }

  async listPending(): Promise<RemotePipelineFile[]> {
    return (await this.records())
      .filter(
        (record) => !record.pipeline && !record.localFileId && !record.deleted,
      )
      .map((record) => new RemotePipelineFile(this, this.folder, record));
  }

  async listCached(): Promise<RemotePipelineFile[]> {
    return (await this.records())
      .filter(
        (record) =>
          record.pipeline?.id &&
          !record.deleted &&
          (!record.localFileId || record.migrated),
      )
      .map((record) => new RemotePipelineFile(this, this.folder, record));
  }

  private filesFromDescriptors(
    descriptors: RemotePipelineDescriptor[],
    records: RemotePipelineRecovery[],
  ): RemotePipelineFile[] {
    const recordsByPath = new Map(
      records.map((record) => [record.filePath, record]),
    );
    return descriptors.flatMap((descriptor) => {
      const summary = descriptor.pipeline;
      const candidate =
        summary.user_id === this.account?.id
          ? recordsByPath.get(summary.file_path)
          : undefined;
      const record =
        !candidate?.pipeline ||
        (candidate.pipeline.id === summary.id &&
          candidate.pipeline.user_id === summary.user_id)
          ? candidate
          : undefined;
      if (
        record &&
        (!record.pipeline ||
          record.deleted ||
          (record.localFileId && !record.migrated))
      )
        return [];
      return [this.fromDescriptor(descriptor, record)];
    });
  }

  async list(): Promise<RemotePipelineFile[]> {
    const records = await this.records();
    let files = records
      .filter(
        (record) => !record.deleted && (!record.localFileId || record.migrated),
      )
      .map((record) => new RemotePipelineFile(this, this.folder, record));
    try {
      const descriptors = (await this.driver.list()).filter(
        (file) => file.pipeline.user_id === this.account?.id,
      );
      // Clean recovery copies are not a second remote catalog after server-side deletion.
      files = [
        ...new Map(
          [
            ...files.filter(
              (file) => !file.recovery.pipeline || file.recovery.dirty,
            ),
            ...this.filesFromDescriptors(descriptors, records),
          ].map((file) => [file.recovery.filePath, file]),
        ).values(),
      ];
      runInAction(() => {
        this.listError = undefined;
      });
    } catch (error) {
      runInAction(() => {
        this.listError = getErrorMessage(error);
      });
    }
    return files;
  }

  private fromDescriptor(
    descriptor: RemotePipelineDescriptor,
    record?: RemotePipelineRecovery,
  ): RemotePipelineFile {
    const summary = descriptor.pipeline;
    const metadata = {
      displayName: descriptor.displayName,
      modifiedAt: descriptor.modifiedAt.getTime(),
    };
    if (record && !record.dirty)
      record = {
        ...record,
        ...metadata,
      };
    return new RemotePipelineFile(
      this,
      this.folder,
      record ?? {
        key: this.summaryRecoveryKey(summary),
        scope: this.scope,
        filePath: summary.file_path,
        ...metadata,
        content: "",
        dirty: false,
      },
      descriptor,
    );
  }

  async resolve(reference: string): Promise<RemotePipelineFile | undefined> {
    if (reference.startsWith("pending:")) {
      const record = await remotePipelineRecoveryDb.copies.get(reference);
      if (!record || record.scope !== this.scope)
        throw new Error(
          "This pending pipeline belongs to another account or backend.",
        );
      if (record.deleted)
        throw new Error("This pipeline has been deleted from the server.");
      await this.driver.connect().catch(() => undefined);
      return new RemotePipelineFile(this, this.folder, record);
    }
    const parsed = parseRemotePipelineReference(reference);
    if (!parsed) return undefined;
    if (parsed.backendUrl !== this.backendUrl)
      throw new Error("This pipeline belongs to a different backend.");
    let loaded;
    try {
      loaded = await this.driver.read(reference);
    } catch (error) {
      const cached = (await this.records()).find(
        (record) =>
          record.pipeline?.id === parsed.pipelineId && !record.deleted,
      );
      if (!cached?.dirty) throw error;
      return new RemotePipelineFile(this, this.folder, cached);
    }
    const { descriptor, content } = loaded;
    const pipeline = descriptor.pipeline;
    const record = await remotePipelineRecoveryDb.copies.get(
      this.summaryRecoveryKey(pipeline),
    );
    // Other owners can use the same file path; never attach our draft to their pipeline.
    const ownRecord =
      pipeline.user_id === this.account?.id &&
      record?.pipeline?.id === pipeline.id &&
      record.pipeline.user_id === pipeline.user_id
        ? record
        : undefined;
    return this.fromDescriptor(
      descriptor,
      ownRecord
        ? { ...ownRecord, pipeline }
        : {
            key: this.summaryRecoveryKey(pipeline),
            scope: this.scope,
            filePath: pipeline.file_path,
            displayName: descriptor.displayName,
            content,
            dirty: false,
            modifiedAt: descriptor.modifiedAt.getTime(),
            pipeline,
            ownerId: descriptor.canEdit ? pipeline.user_id : undefined,
          },
    );
  }

  async resolveLocal(fileId: string): Promise<RemotePipelineFile | undefined> {
    const record = await remotePipelineRecoveryDb.copies
      .where("[scope+localFileId]")
      .equals([this.scope, fileId])
      .first();
    if (!record?.migrated) return undefined;
    if (record.deleted)
      throw new Error("This pipeline has been deleted from the server.");
    await this.driver.connect().catch(() => undefined);
    return new RemotePipelineFile(this, this.folder, record);
  }

  async create(
    name: string,
    content: string,
    source?: PipelineFile,
  ): Promise<RemotePipelineFile> {
    if (!this.backendUrl)
      throw new Error("Configure a backend before creating a remote pipeline.");
    const cloneSource = source?.redirectedFile ?? source;
    const filePath = `pipeline-studio/${crypto.randomUUID()}.yaml`;
    const record: RemotePipelineRecovery = {
      key: this.recoveryKey(filePath),
      scope: this.scope,
      filePath,
      displayName: name,
      content,
      dirty: true,
      modifiedAt: Date.now(),
      cloneSource:
        cloneSource instanceof RemotePipelineFile
          ? cloneSource.recovery.pipeline
          : undefined,
    };
    const file = new RemotePipelineFile(this, this.folder, record);
    await file.persistRecovery(content);
    await file.retry().catch(() => undefined);
    emitUserPipelineWritten();
    return file;
  }

  async migrate(file: PipelineFile): Promise<RemotePipelineFile> {
    return withPipelineLock(file.id, async () => {
      const existing = await this.resolveLocal(file.id);
      if (existing) return existing;
      const content = await file.read();
      const initial = this.localRecovery(file, content);
      // A newer edit can be staged while the local read is in flight.
      const record = await remotePipelineRecoveryDb.transaction(
        "rw",
        remotePipelineRecoveryDb.copies,
        async () => {
          const previous = await remotePipelineRecoveryDb.copies.get(
            initial.key,
          );
          const record = previous
            ? {
                ...previous,
                // A confirmed upload may still need reference migration after interruption.
                dirty: true,
                displayName: file.displayName,
                localStorageKey: file.storageKey,
              }
            : initial;
          await remotePipelineRecoveryDb.copies.put(record);
          return record;
        },
      );
      const remote = new RemotePipelineFile(this, this.folder, record);
      await remote.retry();
      runInAction(() => {
        file.redirectedFile = remote;
      });
      return remote;
    });
  }

  private localRecovery(
    file: PipelineFile,
    content: string,
  ): RemotePipelineRecovery {
    const filePath = `pipeline-studio/${file.id}.yaml`;
    return {
      key: this.recoveryKey(filePath),
      scope: this.scope,
      filePath,
      displayName: file.displayName,
      content,
      dirty: true,
      modifiedAt: Date.now(),
      localFileId: file.id,
      localStorageKey: file.storageKey,
    };
  }

  async stageLocal(file: PipelineFile, content: string): Promise<void> {
    await this.stageRecord(this.localRecovery(file, content), content);
  }

  async readLocalRecovery(file: PipelineFile): Promise<string | undefined> {
    const record = await remotePipelineRecoveryDb.copies.get(
      this.recoveryKey(`pipeline-studio/${file.id}.yaml`),
    );
    if (record?.deleted)
      throw new Error("This pipeline has been deleted from the server.");
    return record?.dirty ? record.content : undefined;
  }

  async read(file: RemotePipelineFile): Promise<string> {
    return withPipelineLock(file.recovery.key, async () => {
      const persisted = await remotePipelineRecoveryDb.copies.get(
        file.recovery.key,
      );
      if (
        persisted &&
        persisted.pipeline?.id ===
          (file.recovery.pipeline ?? file.descriptor?.pipeline)?.id &&
        file.canEdit
      )
        file.setRecovery(persisted);
      if (file.recovery.deleted)
        throw new Error("This pipeline has been deleted from the server.");
      if (file.recovery.dirty) return file.recovery.content;
      const pipelineId = (file.recovery.pipeline ?? file.descriptor?.pipeline)
        ?.id;
      if (!pipelineId) return file.recovery.content;
      const snapshot = file.recovery;
      const loaded = await this.driver.read(
        remotePipelineReference(this.backendUrl, pipelineId),
      );
      const pipeline = loaded.descriptor.pipeline;
      let record: RemotePipelineRecovery = {
        ...snapshot,
        pipeline,
        displayName: loaded.descriptor.displayName,
        content: loaded.content,
        modifiedAt: loaded.descriptor.modifiedAt.getTime(),
      };
      if (pipeline.user_id === this.account?.id)
        record = await this.mergeCompletion(record);
      file.setRecovery(record);
      return record.content;
    });
  }

  async flush(file: RemotePipelineFile): Promise<void> {
    if (!file.canEdit)
      throw new Error("Only the owner can change this remote pipeline.");
    await withPipelineLock(file.recovery.key, async () => {
      let record =
        (await remotePipelineRecoveryDb.copies.get(file.recovery.key)) ??
        file.recovery;
      if (record.deleted)
        throw new Error("This pipeline has been deleted from the server.");
      if (!record.dirty) {
        file.setRecovery(record);
        return;
      }
      try {
        const existing = record.pipeline
          ? this.driver.describe(record.pipeline)
          : undefined;
        const saved = await this.driver.write(
          existing?.storageKey ?? record.filePath,
          record.content,
          {
            existing,
            source: record.cloneSource
              ? this.driver.describe(record.cloneSource)
              : undefined,
          },
        );
        const pipeline = saved.pipeline;
        const referenceId = saved.storageKey;
        record = {
          ...record,
          pipeline,
          cloneSource: undefined,
          dirty: false,
          error: undefined,
          displayName: saved.displayName ?? record.displayName,
          ownerId: pipeline.user_id,
        };
        // Persist the confirmed ID before reference migration so retry never creates a new remote.
        record = await this.mergeCompletion(record);
        if (!record.migrated) {
          await migratePipelineReferences(
            record.localStorageKey ?? record.key,
            referenceId,
            record.displayName,
          );
          record = await this.mergeCompletion({ ...record, migrated: true });
        }
        file.setRecovery(record);
      } catch (error) {
        const failed = await this.mergeCompletion({
          ...record,
          dirty: true,
          error: getErrorMessage(error),
        });
        file.setRecovery(failed);
        throw error;
      }
    });
  }

  async stage(file: RemotePipelineFile, content: string): Promise<void> {
    if (!file.canEdit)
      throw new Error("Only the owner can change this remote pipeline.");
    file.setRecovery(await this.stageRecord(file.recovery, content));
  }

  private async stageRecord(
    recovery: RemotePipelineRecovery,
    content: string,
  ): Promise<RemotePipelineRecovery> {
    return remotePipelineRecoveryDb.transaction(
      "rw",
      remotePipelineRecoveryDb.copies,
      async () => {
        const previous =
          (await remotePipelineRecoveryDb.copies.get(recovery.key)) ?? recovery;
        if (previous.deleted)
          throw new Error("This pipeline has been deleted from the server.");
        const next: RemotePipelineRecovery = {
          ...previous,
          content,
          dirty: true,
          modifiedAt: Date.now(),
          revision: (previous.revision ?? 0) + 1,
        };
        await remotePipelineRecoveryDb.copies.put(next);
        return next;
      },
    );
  }

  private async mergeCompletion(
    completed: RemotePipelineRecovery,
  ): Promise<RemotePipelineRecovery> {
    return remotePipelineRecoveryDb.transaction(
      "rw",
      remotePipelineRecoveryDb.copies,
      async () => {
        const latest = await remotePipelineRecoveryDb.copies.get(completed.key);
        const record =
          latest && latest.revision !== completed.revision
            ? {
                ...completed,
                content: latest.content,
                revision: latest.revision,
                modifiedAt: latest.modifiedAt,
                dirty: true,
              }
            : completed;
        await remotePipelineRecoveryDb.copies.put(record);
        return record;
      },
    );
  }

  async delete(file: RemotePipelineFile): Promise<void> {
    if (!file.canEdit)
      throw new Error("Only the owner can delete this remote pipeline.");
    await withPipelineLock(file.recovery.key, async () => {
      const record =
        (await remotePipelineRecoveryDb.copies.get(file.recovery.key)) ??
        file.recovery;
      const descriptor = record.pipeline
        ? this.driver.describe(record.pipeline)
        : file.descriptor;
      // An initial save can reach the server even when its response never arrives.
      await this.driver.delete(
        descriptor?.storageKey ?? record.filePath,
        descriptor,
      );
      // Stale editors and queued retries must not recreate a deleted pipeline.
      const deleted = {
        ...record,
        deleted: true,
        dirty: false,
        error: undefined,
      };
      await remotePipelineRecoveryDb.copies.put(deleted);
      file.setRecovery(deleted);
      emitUserPipelineWritten();
    });
  }
}

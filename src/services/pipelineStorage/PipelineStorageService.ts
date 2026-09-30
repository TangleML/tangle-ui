import { makeObservable, observable, runInAction } from "mobx";
import { z } from "zod";

import type {
  CloudConnection,
  CloudPipelineSummary,
} from "@/services/cloudPipelineService";
import { getErrorMessage } from "@/utils/string";
import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import {
  type RemotePipelineDescriptor,
  RemotePipelineStorageDriver,
} from "./drivers/RemotePipelineStorageDriver";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { PipelineFile, type RemotePipelineStorage } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findById, findByStorageKey } from "./pipelineRegistry";
import {
  assertLocalPipelineVisible,
  assertNotDeleted,
  mergeRecovery,
  parseRemotePipelineReference,
  recoveryKey,
  recoveryRecords,
  type RemotePipelineRecovery,
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "./remotePipelineRecovery";
import {
  type PipelinePageOptions,
  type PipelineStoragePage,
  ROOT_FOLDER_ID,
} from "./types";

export interface RemotePipelineOptions {
  connection: CloudConnection;
  scope: string;
}

export class PipelineStorageService {
  @observable accessor rootFolder: PipelineFolder;
  @observable accessor remoteListError: string | undefined;
  readonly scope: string;
  private readonly remote?: RemotePipelineStorage;
  private readonly files = new Map<string, PipelineFile>();

  constructor(remoteOptions?: RemotePipelineOptions) {
    this.rootFolder = new PipelineFolder({
      id: ROOT_FOLDER_ID,
      name: "Root",
      parentId: null,
      driver: createDriver({
        driverType: "folder-indexdb",
        folderId: ROOT_FOLDER_ID,
      }),
      manageFile: (file) => this.manageFile(file),
    });
    this.scope = remoteOptions
      ? `${remoteOptions.scope}:${crypto.randomUUID()}`
      : "local";
    if (remoteOptions)
      this.remote = {
        driver: new RemotePipelineStorageDriver(remoteOptions.connection),
        scope: remoteOptions.scope,
      };
    makeObservable(this);
  }

  get remoteEnabled(): boolean {
    return !!this.remote;
  }
  get backendUrl(): string {
    return this.remote?.driver.backendUrl ?? "";
  }

  async createPipeline(
    name: string,
    content: string,
    source?: PipelineFile,
  ): Promise<PipelineFile> {
    if (!this.remote) {
      const existing = await this.resolvePipelineByName(name);
      if (existing) {
        await existing.write(content);
        return existing;
      }
      return this.manageFile(await this.rootFolder.addFile(name, content));
    }
    if (!this.backendUrl)
      throw new Error("Configure a backend before creating a remote pipeline.");
    if (
      source?.remoteId &&
      source.remoteBackendUrl === this.backendUrl &&
      !source.descriptor
    )
      await source.read();
    const documentId = crypto.randomUUID();
    const filePath = `pipeline-studio/${documentId}.yaml`;
    const record: RemotePipelineRecovery = {
      key: recoveryKey(this.remote.scope, filePath),
      documentId,
      scope: this.remote.scope,
      filePath,
      displayName: name,
      content,
      dirty: true,
      modifiedAt: Date.now(),
      cloneSource:
        source?.remoteBackendUrl === this.backendUrl
          ? source.descriptor?.pipeline
          : undefined,
    };
    const file = this.fileFromRecord(record);
    await file.persistRecovery(content);
    await file.retry().catch(() => undefined);
    emitUserPipelineWritten();
    return file;
  }

  canMigrate(file: PipelineFile): boolean {
    return (
      this.remoteEnabled &&
      file.storageKind === "local" &&
      ["root-indexdb", "folder-indexdb"].includes(file.folder.driver.type)
    );
  }

  async migratePipeline(file: PipelineFile): Promise<PipelineFile> {
    if (!this.remote || !this.canMigrate(file))
      throw new Error(
        "Only browser-local pipelines can be saved to the server.",
      );
    file.enableRemoteStorage(this.remote);
    await file.retry();
    return file;
  }

  private manageFile(file: PipelineFile): PipelineFile {
    if (this.canMigrate(file) && this.remote)
      file.enableRemoteStorage(this.remote);
    const cached = this.files.get(file.id);
    if (cached) return cached;
    this.files.set(file.id, file);
    return file;
  }

  private fileFromRecord(
    record: RemotePipelineRecovery,
    descriptor?: RemotePipelineDescriptor,
  ): PipelineFile {
    if (!this.remote) throw new Error("Remote pipelines are not enabled.");
    const summary = record.pipeline ?? record.summary ?? descriptor?.pipeline;
    const id =
      record.documentId ??
      record.localFileId ??
      (summary
        ? remotePipelineReference(this.backendUrl, summary.id)
        : record.key);
    const cached = this.files.get(id);
    if (cached) {
      cached.restoreRecovery(record);
      return cached;
    }
    const file = new PipelineFile({
      id,
      storageKey: descriptor?.storageKey ?? record.key,
      folder: this.rootFolder,
      remote: this.remote,
      recovery: { ...record, documentId: id },
      descriptor,
      createdAt: summary ? new Date(summary.created_at) : undefined,
      modifiedAt: new Date(record.modifiedAt),
    });
    this.files.set(id, file);
    return file;
  }

  async listRemotePipelinePage(
    options: PipelinePageOptions = {},
  ): Promise<PipelineStoragePage<PipelineFile>> {
    if (!this.remote) throw new Error("Remote pipelines are not enabled.");
    options.signal?.throwIfAborted();
    try {
      const [page, records] = await Promise.all([
        this.remote.driver.listPage(options),
        recoveryRecords(this.remote.scope),
      ]);
      options.signal?.throwIfAborted();
      const files = await this.filesFromDescriptors(page.files, records);
      runInAction(() => {
        this.remoteListError = undefined;
      });
      return { ...page, files };
    } catch (error) {
      runInAction(() => {
        this.remoteListError = getErrorMessage(error);
      });
      throw error;
    }
  }

  private async filesFromDescriptors(
    descriptors: RemotePipelineDescriptor[],
    records: RemotePipelineRecovery[],
  ): Promise<PipelineFile[]> {
    if (!this.remote) return [];
    const remote = this.remote;
    const files: PipelineFile[] = [];
    for (const descriptor of descriptors) {
      const summary = descriptor.pipeline;
      const own = summary.user_id === remote.driver.account?.id;
      const candidate = own
        ? (records.find(
            (record) => (record.pipeline ?? record.summary)?.id === summary.id,
          ) ??
          records.find(
            (record) =>
              record.filePath === summary.file_path &&
              !record.pipeline &&
              !record.summary,
          ))
        : undefined;
      const known = candidate?.pipeline ?? candidate?.summary;
      const record =
        candidate &&
        (!known ||
          (known.id === summary.id && known.user_id === summary.user_id))
          ? candidate
          : undefined;
      if (
        record &&
        (!known || record.deleted || (record.localFileId && !record.migrated))
      )
        continue;
      let current = record ?? this.summaryRecord(summary, descriptor);
      if (!current.dirty)
        current = {
          ...current,
          summary,
          displayName: descriptor.displayName,
          modifiedAt: descriptor.modifiedAt.getTime(),
        };
      // Persist summaries independently of the paged query cache; list rows never read definitions.
      if (own) current = await mergeRecovery(current);
      if (!current.deleted)
        files.push(this.fileFromRecord(current, descriptor));
    }
    return files;
  }

  private summaryRecord(
    summary: CloudPipelineSummary,
    descriptor: RemotePipelineDescriptor,
  ): RemotePipelineRecovery {
    if (!this.remote) throw new Error("Remote pipelines are not enabled.");
    return {
      key: `remote:${encodeURIComponent(this.remote.scope)}:${summary.id}`,
      scope: this.remote.scope,
      documentId: remotePipelineReference(this.backendUrl, summary.id),
      filePath: summary.file_path,
      displayName: descriptor.displayName,
      content: "",
      dirty: false,
      modifiedAt: descriptor.modifiedAt.getTime(),
      summary,
      ownerId: descriptor.canEdit ? summary.user_id : undefined,
    };
  }

  async listPendingPipelines(): Promise<PipelineFile[]> {
    if (!this.remote) return [];
    return (await recoveryRecords(this.remote.scope))
      .filter(
        (record) =>
          !record.pipeline &&
          !record.summary &&
          !record.localFileId &&
          !record.deleted,
      )
      .map((record) => this.fileFromRecord(record));
  }

  async listCachedPipelines(): Promise<PipelineFile[]> {
    if (!this.remote) return [];
    return (await recoveryRecords(this.remote.scope))
      .filter(
        (record) =>
          (record.pipeline || record.summary) &&
          !record.deleted &&
          (!record.localFileId || record.migrated),
      )
      .map((record) => this.fileFromRecord(record));
  }

  async filterVisibleLocalPipelines(
    files: PipelineFile[],
  ): Promise<PipelineFile[]> {
    const hiddenIds = new Set(
      (await remotePipelineRecoveryDb.copies.toArray())
        .filter((record) => record.migrated)
        .map((record) => record.localFileId),
    );
    return files
      .filter((file) => !hiddenIds.has(file.id))
      .map((file) => this.manageFile(file));
  }

  async listPipelines(folderId = ROOT_FOLDER_ID): Promise<PipelineFile[]> {
    const folder = await this.findFolderById(folderId);
    if (folderId === ROOT_FOLDER_ID) {
      for (const descriptor of await new RootFolderDbStorageDriver().list())
        if (!(await findByStorageKey(descriptor.storageKey)))
          await folder.assignFile(descriptor.storageKey);
    }
    const local = await this.filterVisibleLocalPipelines(
      await folder.listPipelines(),
    );
    if (folderId !== ROOT_FOLDER_ID || !this.remote) return local;
    try {
      const descriptors = await this.remote.driver.list();
      const records = await recoveryRecords(this.remote.scope);
      const files = await this.filesFromDescriptors(
        descriptors.filter(
          (descriptor) =>
            descriptor.pipeline.user_id === this.remote?.driver.account?.id,
        ),
        records,
      );
      const known = new Set(files.map((file) => file.id));
      const drafts = (await this.listCachedPipelines()).filter(
        (file) => file.recovery?.dirty && !known.has(file.id),
      );
      runInAction(() => {
        this.remoteListError = undefined;
      });
      return [
        ...local,
        ...files,
        ...drafts,
        ...(await this.listPendingPipelines()),
      ];
    } catch (error) {
      runInAction(() => {
        this.remoteListError = getErrorMessage(error);
      });
      return [
        ...local,
        ...(await this.listCachedPipelines()),
        ...(await this.listPendingPipelines()),
      ];
    }
  }

  async findPipelineById(id: string): Promise<PipelineFile> {
    const remote = await this.resolveRemote(id);
    if (remote) return remote;
    await assertLocalPipelineVisible(id);
    const entry = await findById(id);
    if (!entry) {
      if (this.remote && z.string().uuid().safeParse(id).success)
        return this.openRemote(remotePipelineReference(this.backendUrl, id));
      throw new Error(`Pipeline not found: ${id}`);
    }
    return this.manageFile(
      new PipelineFile({
        ...entry,
        folder: await this.findFolderById(entry.folderId),
      }),
    );
  }

  async resolvePipelineByName(name: string): Promise<PipelineFile | undefined> {
    const remote = await this.resolveRemote(name);
    if (remote) return remote;
    const existing = await findByStorageKey(name);
    if (existing) return this.findPipelineById(existing.id);
    const file = await this.rootFolder.findFile(name);
    if (file) return this.manageFile(file);
    if (this.remote && z.string().uuid().safeParse(name).success)
      return this.findPipelineById(name);
    return undefined;
  }

  private async resolveRemote(
    reference: string,
  ): Promise<PipelineFile | undefined> {
    const scoped =
      reference.startsWith("remote:") || reference.startsWith("pending:");
    if (!this.remote) {
      if (scoped)
        throw new Error(
          "Remote pipelines are not enabled for this deployment.",
        );
      return undefined;
    }
    if (reference.startsWith("remote:")) return this.openRemote(reference);
    const record = (await recoveryRecords(this.remote.scope)).find(
      (candidate) =>
        candidate.key === reference ||
        candidate.documentId === reference ||
        (candidate.localFileId === reference && candidate.migrated),
    );
    if (record && (!record.localFileId || record.migrated)) {
      assertNotDeleted(record);
      const saved = record.pipeline ?? record.summary;
      if (saved && !record.dirty)
        return this.openRemote(
          remotePipelineReference(this.backendUrl, saved.id),
        );
      await this.remote.driver.connect().catch(() => undefined);
      return this.fileFromRecord(record);
    }
    if (reference.startsWith("pending:"))
      throw new Error(
        "This pending pipeline belongs to another account or backend.",
      );
    return undefined;
  }

  private async openRemote(reference: string): Promise<PipelineFile> {
    if (!this.remote) throw new Error("Remote pipelines are not enabled.");
    const parsed = parseRemotePipelineReference(reference);
    if (!parsed || parsed.backendUrl !== this.backendUrl)
      throw new Error("This pipeline belongs to a different backend.");
    const records = await recoveryRecords(this.remote.scope);
    const existing = records.find(
      (record) => (record.pipeline ?? record.summary)?.id === parsed.pipelineId,
    );
    if (existing) assertNotDeleted(existing);
    const cached = [...this.files.values()].find(
      (file) => file.referenceId === reference,
    );
    if (cached) {
      if (existing) cached.restoreRecovery(existing);
      return cached;
    }
    if (existing) {
      await this.remote.driver.connect().catch(() => undefined);
      return this.fileFromRecord(existing);
    }
    const file = new PipelineFile({
      id: reference,
      storageKey: reference,
      folder: this.rootFolder,
      remote: this.remote,
      remoteReference: reference,
    });
    this.files.set(file.id, file);
    return file;
  }

  async findFolderById(id: string): Promise<PipelineFolder> {
    return id === ROOT_FOLDER_ID
      ? this.rootFolder
      : PipelineFolder.resolveById(id, (file) => this.manageFile(file));
  }

  async getAllFolders(): Promise<PipelineFolder[]> {
    return (await pipelineStorageDb.folders.toArray()).map((entry) =>
      PipelineFolder.fromEntry(entry, (file) => this.manageFile(file)),
    );
  }

  async getFavoriteFolders(): Promise<PipelineFolder[]> {
    return (
      await pipelineStorageDb.folders
        .filter((folder) => folder.favorite === true)
        .toArray()
    )
      .map((entry) =>
        PipelineFolder.fromEntry(entry, (file) => this.manageFile(file)),
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
}

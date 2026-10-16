import { makeObservable, observable } from "mobx";

import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { RemotePipelineDraftStorageDriver } from "./drivers/RemotePipelineDraftStorageDriver";
import { RemotePipelineStorageDriver } from "./drivers/RemotePipelineStorageDriver";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { movePipelineAssociationsToRemote } from "./pipelineAssociations";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import {
  findPipelineMigration,
  rememberPipelineMigration,
} from "./pipelineMigrations";
import { findById, findByStorageKey } from "./pipelineRegistry";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineDraftRef,
  isRemotePipelineRef,
  type PipelineStorageDriver,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
  ROOT_FOLDER_ID,
} from "./types";

const ROOT_DRIVER_CONFIG = {
  driverType: "folder-indexdb",
  folderId: ROOT_FOLDER_ID,
} as const;

export class PipelineStorageService {
  private readonly remoteDrafts = new Map<
    string,
    { ref: RemotePipelineDraftRef; file: PipelineFile }
  >();
  @observable accessor rootFolder: PipelineFolder;

  constructor() {
    this.rootFolder = createRoot({
      driver: createDriver(ROOT_DRIVER_CONFIG),
    });
    makeObservable(this);
  }

  async resolvePipeline(ref: EditorPipelineRef): Promise<PipelineFile> {
    if (isRemotePipelineDraftRef(ref)) {
      return (
        this.remoteDrafts.get(getEditorPipelineIdentity(ref))?.file ??
        this.createRemoteDraft(ref)
      );
    }
    if (isRemotePipelineRef(ref)) {
      return remoteFile(await RemotePipelineStorageDriver.open(ref));
    }

    if (ref.fileId) {
      if (await findById(ref.fileId)) {
        return this.findPipelineById(ref.fileId);
      }
    } else {
      const file = await this.resolvePipelineByName(ref.name);
      if (file) return file;

      const legacyDriver = new RootFolderDbStorageDriver();
      if (await legacyDriver.hasKey(ref.name)) {
        return this.rootFolder.assignFile(ref.name);
      }
    }
    const migration = await findPipelineMigration(ref);
    if (migration) {
      return this.resolvePipeline(migration.remote);
    }
    throw new Error(`Pipeline "${ref.name}" not found`);
  }

  createRemoteDraft(
    ref: RemotePipelineDraftRef,
    onCreated?: (remote: RemotePipelineRef) => Promise<unknown>,
  ): PipelineFile {
    const driver = new RemotePipelineDraftStorageDriver(ref, async (remote) => {
      file.promoteToRemote(remote);
      await onCreated?.(remote);
    });
    const file = new PipelineFile({
      id: ref.draftId,
      storageKey: ref.name,
      draftBackendUrl: ref.backendUrl,
      folder: new PipelineFolder({
        id: getEditorPipelineIdentity(ref),
        name: "Remote pipelines",
        parentId: null,
        driver,
      }),
    });
    this.remoteDrafts.set(getEditorPipelineIdentity(ref), { ref, file });
    return file;
  }

  getRemoteDraftRef(
    draftId: string,
    backendUrl: string,
  ): RemotePipelineDraftRef {
    const draft = [...this.remoteDrafts.values()].find(
      ({ ref }) => ref.draftId === draftId && ref.backendUrl === backendUrl,
    );
    if (!draft)
      throw new Error("This unsaved pipeline draft is no longer available.");
    return draft.ref;
  }

  discardRemoteDraft(ref: RemotePipelineDraftRef): void {
    this.remoteDrafts.delete(getEditorPipelineIdentity(ref));
  }

  async createRemotePipeline(
    backendUrl: string,
    name: string,
    content: string,
    filePath?: string,
  ): Promise<PipelineFile> {
    const file = remoteFile(
      await RemotePipelineStorageDriver.create(
        backendUrl,
        name,
        content,
        filePath,
      ),
    );
    emitUserPipelineWritten();
    return file;
  }

  async moveLocalPipelineToRemote(
    pipeline: string | PipelineFile,
    backendUrl: string,
    onCreated?: (remote: PipelineFile) => Promise<unknown>,
  ): Promise<PipelineFile> {
    const local =
      typeof pipeline === "string"
        ? await this.resolvePipeline({ name: pipeline })
        : pipeline;
    if (local.remote) {
      await onCreated?.(local);
      return local;
    }
    const migration = await findPipelineMigration({
      name: local.storageKey,
      fileId: local.id,
    });
    const remote = migration
      ? remoteFile(await RemotePipelineStorageDriver.open(migration.remote))
      : await this.createRemotePipeline(
          backendUrl,
          local.storageKey,
          await local.read(),
          `pipelines/${local.id}.yaml`,
        );
    try {
      await rememberPipelineMigration(
        local,
        migration?.remote ?? {
          source: "remote",
          backendUrl,
          pipelineId: remote.id,
        },
        remote.storageKey,
      );
      await onCreated?.(remote);
      await movePipelineAssociationsToRemote(local, remote);
    } catch (cause) {
      throw new Error(
        "Pipeline was saved remotely, but its local links could not be updated. The local copy was kept.",
        { cause },
      );
    }
    try {
      await local.deleteFile();
    } catch (cause) {
      throw new Error(
        "Pipeline was saved remotely, but the local copy could not be removed.",
        { cause },
      );
    }
    return remote;
  }

  async findPipelineById(id: string): Promise<PipelineFile> {
    const entry = await findById(id);
    if (!entry) {
      throw new Error(`Pipeline not found: ${id}`);
    }

    return new PipelineFile({
      id: entry.id,
      storageKey: entry.storageKey,
      folder: await this.findFolderById(entry.folderId),
    });
  }

  async resolvePipelineByName(name: string): Promise<PipelineFile | undefined> {
    const existing = await findByStorageKey(name);

    if (!existing) return this.rootFolder.findFile(name);

    const folder = await this.findFolderById(existing.folderId);

    return folder.findFile(name);
  }

  async findFolderById(id: string): Promise<PipelineFolder> {
    if (id === ROOT_FOLDER_ID) {
      return this.rootFolder;
    }

    return PipelineFolder.resolveById(id);
  }

  async getAllFolders(): Promise<PipelineFolder[]> {
    const entries = await pipelineStorageDb.folders.toArray();
    return entries.map((entry) => PipelineFolder.fromEntry(entry));
  }

  async getFavoriteFolders(): Promise<PipelineFolder[]> {
    const entries = await pipelineStorageDb.folders
      .filter((f) => f.favorite === true)
      .toArray();
    return entries
      .map((entry) => PipelineFolder.fromEntry(entry))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }
}

function createRoot(options?: { driver: PipelineStorageDriver }) {
  return new PipelineFolder({
    id: ROOT_FOLDER_ID,
    name: "Root",
    parentId: null,
    driver: options?.driver ?? createDriver({ driverType: "root-indexdb" }),
  });
}

function remoteFile(driver: RemotePipelineStorageDriver): PipelineFile {
  const remote = {
    backendUrl: driver.backendUrl,
    pipelineId: driver.pipelineId,
  };
  return new PipelineFile({
    id: driver.pipelineId,
    storageKey: driver.name,
    remote,
    folder: new PipelineFolder({
      id: getEditorPipelineIdentity({ source: "remote", ...remote }),
      name: "Remote pipelines",
      parentId: null,
      driver,
    }),
  });
}

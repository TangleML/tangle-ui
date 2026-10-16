import { makeObservable, observable } from "mobx";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { RemotePipelineStorageDriver } from "./drivers/RemotePipelineStorageDriver";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findById, findByStorageKey } from "./pipelineRegistry";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineRef,
  type PipelineStorageDriver,
  ROOT_FOLDER_ID,
} from "./types";

const ROOT_DRIVER_CONFIG = {
  driverType: "folder-indexdb",
  folderId: ROOT_FOLDER_ID,
} as const;

export class PipelineStorageService {
  @observable accessor rootFolder: PipelineFolder;

  constructor() {
    this.rootFolder = createRoot({
      driver: createDriver(ROOT_DRIVER_CONFIG),
    });
    makeObservable(this);
  }

  async resolvePipeline(ref: EditorPipelineRef): Promise<PipelineFile> {
    if (isRemotePipelineRef(ref)) {
      return remoteFile(await RemotePipelineStorageDriver.open(ref));
    }

    const file = ref.fileId
      ? await this.findPipelineById(ref.fileId)
      : await this.resolvePipelineByName(ref.name);
    if (file) return file;

    const legacyDriver = new RootFolderDbStorageDriver();
    if (await legacyDriver.hasKey(ref.name)) {
      return this.rootFolder.assignFile(ref.name);
    }
    throw new Error(`Pipeline "${ref.name}" not found`);
  }

  async createRemotePipeline(
    backendUrl: string,
    name: string,
    content: string,
  ): Promise<PipelineFile> {
    return remoteFile(
      await RemotePipelineStorageDriver.create(backendUrl, name, content),
    );
  }

  async copyRemotePipeline(
    source: PipelineFile,
    name: string,
    content: string,
  ): Promise<PipelineFile> {
    const driver = source.folder.driver;
    if (!(driver instanceof RemotePipelineStorageDriver)) {
      throw new Error("The source pipeline is not a remote document.");
    }
    return remoteFile(await driver.copy(name, content));
  }

  async moveLocalPipelineToRemote(
    name: string,
    backendUrl: string,
  ): Promise<PipelineFile> {
    const local = await this.resolvePipeline({ name });
    const remote = await this.createRemotePipeline(
      backendUrl,
      name,
      await local.read(),
    );
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

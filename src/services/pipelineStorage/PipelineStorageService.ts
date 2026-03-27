import { makeObservable, observable } from "mobx";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findById, findByStorageKey } from "./pipelineRegistry";
import { type PipelineStorageDriver, ROOT_FOLDER_ID } from "./types";

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

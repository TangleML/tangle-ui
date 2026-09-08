import { makeObservable, observable } from "mobx";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findById, findByStorageKey } from "./pipelineRegistry";
import { resolveStorageMode, type StorageMode } from "./storageMode";
import { ROOT_FOLDER_ID } from "./types";

export class PipelineStorageService {
  @observable accessor rootFolder: PipelineFolder;

  readonly mode: StorageMode;

  constructor() {
    this.mode = resolveStorageMode();
    this.rootFolder = createRoot(this.mode);
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

    if (this.rootFolder.isFlat) {
      throw new Error(`Folder not available in ${this.rootFolder.name}: ${id}`);
    }

    return PipelineFolder.resolveById(id);
  }

  async getAllFolders(): Promise<PipelineFolder[]> {
    if (this.rootFolder.isFlat) return [];

    const entries = await pipelineStorageDb.folders.toArray();
    return entries.map((entry) => PipelineFolder.fromEntry(entry));
  }

  async getFavoriteFolders(): Promise<PipelineFolder[]> {
    if (this.rootFolder.isFlat) return [];

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

function createRoot(mode: StorageMode): PipelineFolder {
  if (mode.kind === "host") {
    return new PipelineFolder({
      id: ROOT_FOLDER_ID,
      name: mode.label,
      parentId: null,
      driver: createDriver({ driverType: "host" }),
      isFlat: true,
    });
  }

  return new PipelineFolder({
    id: ROOT_FOLDER_ID,
    name: "Root",
    parentId: null,
    driver: createDriver({
      driverType: "folder-indexdb",
      folderId: ROOT_FOLDER_ID,
    }),
  });
}

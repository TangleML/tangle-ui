import { makeObservable, observable } from "mobx";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { PipelineFile } from "./PipelineFile";
import { PipelineFolder } from "./PipelineFolder";
import { findById, findByStorageKey } from "./pipelineRegistry";
import { resolveStorageMode, type StorageMode } from "./storageMode";
import { type PipelineRef, ROOT_FOLDER_ID } from "./types";

export class PipelineNotFoundError extends Error {
  readonly name = "PipelineNotFoundError";
}

export class AmbiguousPipelineNameError extends Error {
  readonly name = "AmbiguousPipelineNameError";
}

export class PipelineStorageService {
  @observable accessor rootFolder: PipelineFolder;

  readonly mode: StorageMode;

  constructor() {
    this.mode = resolveStorageMode();
    this.rootFolder = createRoot(this.mode);
    makeObservable(this);
  }

  /**
   * The one way to turn a route's reference into a file. `fileId` is the real
   * identity, so a reference carrying one that cannot be found is an error
   * rather than an invitation to fall back to the name and open whatever
   * happens to share it.
   */
  async resolve(ref: PipelineRef): Promise<PipelineFile> {
    if (ref.fileId) return this.findPipelineById(ref.fileId);

    const byName = await this.resolvePipelineByName(ref.name);
    if (byName) return byName;

    const adopted = await this.adoptFromLegacyStore(ref.name);
    if (adopted) return adopted;

    throw new PipelineNotFoundError(`Pipeline "${ref.name}" not found`);
  }

  async findPipelineById(id: string): Promise<PipelineFile> {
    const entry = await findById(id);

    if (entry) {
      return new PipelineFile({
        id: entry.id,
        storageKey: entry.storageKey,
        folder: await this.findFolderById(entry.folderId),
      });
    }

    /**
     * A registry row caches what the store itself reported, so a miss means
     * "not seen on this device yet" rather than "does not exist" — a shared
     * link opened in a fresh browser lands here.
     */
    const listed = await this.rootFolder.listPipelines();
    const found = listed.find((file) => file.id === id);

    if (!found) {
      throw new PipelineNotFoundError(`Pipeline not found: ${id}`);
    }

    return found;
  }

  async resolvePipelineByName(name: string): Promise<PipelineFile | undefined> {
    if (this.rootFolder.isFlat) {
      return resolveInFlatStore(this.rootFolder, name);
    }

    const existing = await findByStorageKey(name);

    if (!existing) return this.rootFolder.findFile(name);

    const folder = await this.findFolderById(existing.folderId);

    return folder.findFile(name);
  }

  /**
   * Pipelines predating the registry live in the legacy list under their name
   * and have no row pointing at them, so opening one by name has to claim it.
   * A store with opaque keys has no such history and no such names.
   */
  private async adoptFromLegacyStore(
    name: string,
  ): Promise<PipelineFile | undefined> {
    if (this.rootFolder.isFlat) return undefined;

    const exists = await new RootFolderDbStorageDriver().hasKey(name);
    if (!exists) return undefined;

    return this.rootFolder.assignFile(name);
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

/**
 * Opaque keys mean the route's slug may be either the key or the displayed
 * name, and one listing answers both. Two pipelines may legitimately share a
 * name, so an ambiguous slug is refused rather than guessed at.
 */
async function resolveInFlatStore(
  folder: PipelineFolder,
  name: string,
): Promise<PipelineFile | undefined> {
  const files = await folder.listPipelines();

  const byKey = files.find((file) => file.storageKey === name);
  if (byKey) return byKey;

  const byName = files.filter((file) => file.displayName === name);

  if (byName.length > 1) {
    throw new AmbiguousPipelineNameError(
      `More than one pipeline is called "${name}". Open it from the pipeline list instead.`,
    );
  }

  return byName[0];
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

import { action, makeObservable, observable } from "mobx";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { PipelineFile } from "./PipelineFile";
import {
  addEntry,
  assertStorageKeyUnique,
  deleteFoldersAndDetachEntries,
  findByStorageKey,
} from "./pipelineRegistry";
import {
  type DriverConfig,
  type FolderEntry,
  type PipelineStorageDriver,
  ROOT_FOLDER_ID,
} from "./types";

interface PipelineFolderInit {
  id: string;
  name: string;
  parentId: string | null;
  driver: PipelineStorageDriver;
  favorite?: boolean;
  createdAt?: number;
}

class FolderNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FolderNotFoundError";
  }
}

export class PipelineFolder {
  static fromEntry(entry: FolderEntry): PipelineFolder {
    return new PipelineFolder({
      id: entry.id,
      name: entry.name,
      parentId: entry.parentId,
      driver: createDriver(entry.driverConfig),
      favorite: entry.favorite,
      createdAt: entry.createdAt,
    });
  }

  static async resolveById(id: string): Promise<PipelineFolder> {
    const entry = await pipelineStorageDb.folders.get(id);
    if (!entry) {
      throw new FolderNotFoundError(`Folder not found: ${id}`);
    }

    return PipelineFolder.fromEntry(entry);
  }

  readonly id: string;
  readonly isRoot: boolean;
  readonly parentId: string | null;
  readonly driver: PipelineStorageDriver;
  readonly createdAt: number;

  @observable accessor name: string;
  @observable accessor favorite: boolean;

  get requiresPermission(): boolean {
    return this.driver.permissions != null;
  }

  get canMoveFilesOut(): boolean {
    return this.driver.allowsMoveOut;
  }

  get canAcceptFiles(): boolean {
    return this.driver.allowsMoveIn;
  }

  constructor(options: PipelineFolderInit) {
    this.isRoot = options.id === ROOT_FOLDER_ID;
    this.id = options.id;

    this.name = options.name;
    this.parentId = options.parentId;
    this.driver = options.driver;
    this.favorite = options.favorite ?? false;
    this.createdAt = options.createdAt ?? 0;

    makeObservable(this);
  }

  async listPipelines(): Promise<PipelineFile[]> {
    const descriptors = await this.driver.list();

    return Promise.all(
      descriptors.map((d) =>
        resolveOrCreateRegistryEntry(d.storageKey, this, {
          createdAt: d.createdAt,
          modifiedAt: d.modifiedAt,
        }),
      ),
    );
  }

  async findFile(storageKey: string): Promise<PipelineFile | undefined> {
    const hasKey = await this.driver.hasKey(storageKey);
    if (!hasKey) return undefined;

    return resolveOrCreateRegistryEntry(storageKey, this);
  }

  async assignFile(storageKey: string): Promise<PipelineFile> {
    return resolveOrCreateRegistryEntry(storageKey, this);
  }

  async addFile(storageKey: string, content: string): Promise<PipelineFile> {
    await assertStorageKeyUnique(storageKey);

    const id = crypto.randomUUID();
    await addEntry({ id, storageKey, folderId: this.id });
    await this.driver.write(storageKey, content);

    return new PipelineFile({ id, storageKey, folder: this });
  }

  async listSubfolders(): Promise<PipelineFolder[]> {
    const entries = await queryChildFolders(this.id);

    return sortByName(entries).map((entry) => PipelineFolder.fromEntry(entry));
  }

  async createSubfolder(options: {
    name: string;
    driverConfig?: DriverConfig;
  }): Promise<PipelineFolder> {
    const id = crypto.randomUUID();
    const driverConfig: DriverConfig = options.driverConfig ?? {
      driverType: "folder-indexdb",
      folderId: id,
    };
    const parentId = this.id;

    await pipelineStorageDb.folders.add({
      id,
      name: options.name,
      parentId,
      driverConfig,
      createdAt: Date.now(),
    });

    return new PipelineFolder({
      id,
      name: options.name,
      parentId,
      driver: createDriver(driverConfig),
    });
  }

  @action
  async renameFolder(newName: string): Promise<void> {
    await pipelineStorageDb.folders.update(this.id, { name: newName });
    this.name = newName;
  }

  @action
  async toggleFavorite(): Promise<boolean> {
    const newValue = !this.favorite;
    await pipelineStorageDb.folders.update(this.id, { favorite: newValue });
    this.favorite = newValue;
    return newValue;
  }

  async moveToParent(newParentId: string | null): Promise<void> {
    if (this.id === newParentId) return;
    await pipelineStorageDb.folders.update(this.id, { parentId: newParentId });
  }

  async breadcrumbPath(): Promise<PipelineFolder[]> {
    return buildBreadcrumbPath(this);
  }

  async deleteFolder(): Promise<void> {
    const descendantIds = await collectDescendantIds(this.id);
    await deleteFoldersAndDetachEntries([this.id, ...descendantIds]);
  }
}

// --- Free functions (not on the class to keep FTA score low) ---

async function buildBreadcrumbPath(
  folder: PipelineFolder,
): Promise<PipelineFolder[]> {
  if (folder.isRoot) return [];

  const path: PipelineFolder[] = [folder];
  let currentParentId = folder.parentId;

  while (currentParentId !== null) {
    const entry = await pipelineStorageDb.folders.get(currentParentId);
    if (!entry) break;
    path.unshift(PipelineFolder.fromEntry(entry));
    currentParentId = entry.parentId;
  }

  return path;
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

async function queryChildFolders(parentId: string | null) {
  if (parentId === null) {
    return pipelineStorageDb.folders
      .filter((f) => f.parentId === null)
      .toArray();
  }
  return pipelineStorageDb.folders.where("parentId").equals(parentId).toArray();
}

async function collectDescendantIds(parentId: string): Promise<string[]> {
  const children = await pipelineStorageDb.folders
    .where("parentId")
    .equals(parentId)
    .toArray();

  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    const nested = await collectDescendantIds(child.id);
    ids.push(...nested);
  }
  return ids;
}

interface FileMetadata {
  createdAt?: Date;
  modifiedAt?: Date;
}

async function resolveOrCreateRegistryEntry(
  storageKey: string,
  folder: PipelineFolder,
  metadata?: FileMetadata,
): Promise<PipelineFile> {
  const existing = await findByStorageKey(storageKey);

  if (existing) {
    return new PipelineFile({
      id: existing.id,
      storageKey: existing.storageKey,
      folder,
      ...metadata,
    });
  }

  const id = crypto.randomUUID();
  await addEntry({ id, storageKey, folderId: folder.id });
  return new PipelineFile({ id, storageKey, folder, ...metadata });
}

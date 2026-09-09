import { action, makeObservable, observable } from "mobx";

import { createDriver } from "./createDriver";
import { pipelineStorageDb } from "./db";
import { PipelineFile } from "./PipelineFile";
import { emitPipelineFileChanged } from "./pipelineFileEvents";
import {
  addEntry,
  assertStorageKeyUnique,
  claimEntry,
  deleteEntry,
  deleteFoldersAndDetachEntries,
  getAllByFolderId,
  updateEntry,
} from "./pipelineRegistry";
import {
  type DriverConfig,
  type FolderEntry,
  type PipelineFileDescriptor,
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
  isFlat?: boolean;
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
  readonly isFlat: boolean;
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
    this.isFlat = options.isFlat ?? false;
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

    if (this.driver.listingIsAuthoritative) {
      await reconcileRegistryToListing(this.id, descriptors);
    }

    return Promise.all(
      descriptors.map((descriptor) =>
        resolveOrCreateRegistryEntry(descriptor, this),
      ),
    );
  }

  async findFile(storageKey: string): Promise<PipelineFile | undefined> {
    const descriptor = await this.describeKey(storageKey);
    if (!descriptor) return undefined;

    return resolveOrCreateRegistryEntry(descriptor, this);
  }

  private async describeKey(
    storageKey: string,
  ): Promise<PipelineFileDescriptor | undefined> {
    if (this.driver.describe) return this.driver.describe(storageKey);

    return (await this.driver.hasKey(storageKey)) ? { storageKey } : undefined;
  }

  async assignFile(storageKey: string): Promise<PipelineFile> {
    return resolveOrCreateRegistryEntry({ storageKey }, this);
  }

  async addFile(storageKey: string, content: string): Promise<PipelineFile> {
    /**
     * A flat store hands back its own key, so the caller's is a suggestion the
     * write upserts on — there is nothing to collide with, and asking would
     * cost a round trip to learn that.
     */
    if (!this.isFlat) await assertStorageKeyUnique(storageKey);

    // Writing before registering means a rejected write leaves no registry row
    // pointing at a file that was never created.
    const descriptor = await this.driver.write(storageKey, content);
    const id = descriptor.externalId ?? crypto.randomUUID();
    await addEntry({
      id,
      storageKey: descriptor.storageKey,
      folderId: this.id,
      contentVersion: descriptor.contentVersion,
    });

    return new PipelineFile({ id, folder: this, ...descriptor });
  }

  async listSubfolders(): Promise<PipelineFolder[]> {
    if (this.isFlat) return [];

    const entries = await queryChildFolders(this.id);

    return sortByName(entries).map((entry) => PipelineFolder.fromEntry(entry));
  }

  async createSubfolder(options: {
    name: string;
    driverConfig?: DriverConfig;
  }): Promise<PipelineFolder> {
    if (this.isFlat) {
      throw new Error(`"${this.name}" does not support folders`);
    }

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

async function resolveOrCreateRegistryEntry(
  descriptor: PipelineFileDescriptor,
  folder: PipelineFolder,
): Promise<PipelineFile> {
  const claimed = await claimEntry({
    id: descriptor.externalId ?? crypto.randomUUID(),
    storageKey: descriptor.storageKey,
    folderId: folder.id,
    contentVersion: descriptor.contentVersion,
  });

  return new PipelineFile({ id: claimed.id, folder, ...descriptor });
}

/**
 * Aligns the registry with a store that owns its own listing: rows the store no
 * longer reports are dropped, and a moved `contentVersion` is announced so an
 * editor holding the file reloads it.
 */
async function reconcileRegistryToListing(
  folderId: string,
  descriptors: PipelineFileDescriptor[],
): Promise<void> {
  const known = await getAllByFolderId(folderId);
  const listed = new Map(descriptors.map((d) => [d.storageKey, d]));

  for (const entry of known) {
    const descriptor = listed.get(entry.storageKey);

    if (!descriptor) {
      await deleteEntry(entry.id);
      continue;
    }

    if (
      descriptor.contentVersion === undefined ||
      descriptor.contentVersion === entry.contentVersion
    ) {
      continue;
    }

    await updateEntry(entry.id, { contentVersion: descriptor.contentVersion });
    emitPipelineFileChanged({
      storageKey: entry.storageKey,
      source: "remote",
    });
  }
}

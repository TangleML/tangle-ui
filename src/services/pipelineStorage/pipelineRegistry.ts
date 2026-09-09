import { pipelineStorageDb } from "./db";
import { currentStorageKind } from "./storageMode";
import { type PipelineRegistryEntry, ROOT_FOLDER_ID } from "./types";

export type NewPipelineRegistryEntry = Omit<PipelineRegistryEntry, "storage">;

/**
 * Every lookup is scoped to the store this page load is using, so a row written
 * against the other one can never answer for a pipeline here. The scope is read
 * rather than passed because storage mode is fixed for the life of the page and
 * a caller that could get it wrong is a caller that eventually does.
 */
function scoped() {
  return { storage: currentStorageKind() };
}

/**
 * Two listings running at once both find no row for a storage key and both try
 * to add one, and the unique index fails the loser — taking down a whole
 * listing over a row that already says what it wanted to say. Claiming inside a
 * transaction makes the second one find the first one's row instead.
 */
export async function claimEntry(
  entry: NewPipelineRegistryEntry,
): Promise<PipelineRegistryEntry> {
  const row: PipelineRegistryEntry = { ...scoped(), ...entry };

  return pipelineStorageDb.transaction(
    "rw",
    pipelineStorageDb.pipeline_registry,
    async () => {
      const existing = await findByStorageKey(entry.storageKey);
      if (existing) return existing;

      await pipelineStorageDb.pipeline_registry.add(row);
      return row;
    },
  );
}

export async function updateEntry(
  id: string,
  updates: Partial<Omit<PipelineRegistryEntry, "id" | "storage">>,
): Promise<void> {
  await pipelineStorageDb.pipeline_registry.update(id, updates);
}

export async function deleteEntry(id: string): Promise<void> {
  await pipelineStorageDb.pipeline_registry.delete(id);
}

export async function findById(
  id: string,
): Promise<PipelineRegistryEntry | undefined> {
  const entry = await pipelineStorageDb.pipeline_registry.get(id);
  return entry?.storage === currentStorageKind() ? entry : undefined;
}

export async function findByStorageKey(
  storageKey: string,
): Promise<PipelineRegistryEntry | undefined> {
  return pipelineStorageDb.pipeline_registry
    .where({ ...scoped(), storageKey })
    .first();
}

export async function getAllByFolderId(
  folderId: string,
): Promise<PipelineRegistryEntry[]> {
  return pipelineStorageDb.pipeline_registry
    .where({ ...scoped(), folderId })
    .toArray();
}

export async function findByFolderAndStorageKey(
  folderId: string,
  storageKey: string,
): Promise<PipelineRegistryEntry | undefined> {
  return pipelineStorageDb.pipeline_registry
    .where({ ...scoped(), folderId, storageKey })
    .first();
}

export async function assertStorageKeyUnique(
  storageKey: string,
): Promise<void> {
  const existing = await findByStorageKey(storageKey);
  if (existing) {
    throw new Error(`Pipeline "${storageKey}" already exists`);
  }
}

async function detachEntriesFromFolders(folderIds: string[]): Promise<void> {
  await pipelineStorageDb.pipeline_registry
    .where("folderId")
    .anyOf(folderIds)
    .modify({ folderId: ROOT_FOLDER_ID });
}

/**
 * Atomically detach registry entries from the given folders,
 * then delete the folders themselves — all inside a single Dexie transaction.
 */
export async function deleteFoldersAndDetachEntries(
  folderIds: string[],
): Promise<void> {
  await pipelineStorageDb.transaction(
    "rw",
    pipelineStorageDb.folders,
    pipelineStorageDb.pipeline_registry,
    async () => {
      await detachEntriesFromFolders(folderIds);
      await pipelineStorageDb.folders.bulkDelete(folderIds);
    },
  );
}

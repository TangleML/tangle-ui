import { pipelineStorageDb } from "./db";
import { type PipelineRegistryEntry, ROOT_FOLDER_ID } from "./types";

export async function addEntry(entry: PipelineRegistryEntry): Promise<void> {
  await pipelineStorageDb.pipeline_registry.add(entry);
}

export async function updateEntry(
  id: string,
  updates: Partial<Omit<PipelineRegistryEntry, "id">>,
): Promise<void> {
  await pipelineStorageDb.pipeline_registry.update(id, updates);
}

export async function deleteEntry(id: string): Promise<void> {
  await pipelineStorageDb.pipeline_registry.delete(id);
}

export async function findById(
  id: string,
): Promise<PipelineRegistryEntry | undefined> {
  return pipelineStorageDb.pipeline_registry.get(id);
}

export async function findByStorageKey(
  storageKey: string,
): Promise<PipelineRegistryEntry | undefined> {
  return pipelineStorageDb.pipeline_registry
    .where("storageKey")
    .equals(storageKey)
    .first();
}

export async function getAllEntries(): Promise<PipelineRegistryEntry[]> {
  return pipelineStorageDb.pipeline_registry.toArray();
}

export async function getAllByFolderId(
  folderId: string,
): Promise<PipelineRegistryEntry[]> {
  return pipelineStorageDb.pipeline_registry
    .where("folderId")
    .equals(folderId)
    .toArray();
}

export async function findByFolderAndStorageKey(
  folderId: string,
  storageKey: string,
): Promise<PipelineRegistryEntry | undefined> {
  return pipelineStorageDb.pipeline_registry
    .where({ folderId, storageKey })
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

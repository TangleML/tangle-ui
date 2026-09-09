import { Dexie, type EntityTable } from "dexie";

import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { isHostStorage } from "./storageMode";
import {
  type CachedPipelineSpec,
  type FolderEntry,
  type PipelineRegistryEntry,
  ROOT_FOLDER_ID,
} from "./types";

export type PipelineStorageDb = Dexie & {
  pipeline_registry: EntityTable<PipelineRegistryEntry, "id">;
  folders: EntityTable<FolderEntry, "id">;
  pipeline_specs: EntityTable<CachedPipelineSpec, "storageKey">;
};

export const pipelineStorageDb = new Dexie(
  "tangle_pipelines",
) as PipelineStorageDb;

pipelineStorageDb.version(1).stores({
  pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
  folders: "id, parentId",
});

pipelineStorageDb.version(2).stores({
  pipeline_registry:
    "id, &storageKey, folderId, [folderId+storageKey], remoteStorageKey",
  folders: "id, parentId",
});

pipelineStorageDb
  .version(3)
  .stores({
    pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
    folders: "id, parentId",
  })
  .upgrade(async (tx) => {
    await tx
      .table("pipeline_registry")
      .toCollection()
      .modify((entry: Record<string, unknown>) => {
        delete entry.remoteStorageKey;
      });

    /**
     * An earlier shape of this feature kept the host alongside local storage as
     * a child folder. A row whose driver cannot be built takes the whole folder
     * listing down with it, and the host is now the root rather than a child,
     * so those rows have nothing left to describe.
     */
    const hostFolders = await tx
      .table<FolderEntry>("folders")
      .filter((folder) => folder.driverConfig.driverType === "host")
      .toArray();

    for (const folder of hostFolders) {
      await tx
        .table<PipelineRegistryEntry>("pipeline_registry")
        .where("folderId")
        .equals(folder.id)
        .delete();
      await tx.table<FolderEntry>("folders").delete(folder.id);
    }
  });

pipelineStorageDb.version(4).stores({
  pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
  folders: "id, parentId",
  pipeline_specs: "storageKey",
});

pipelineStorageDb.on("ready", async () => {
  await seedRegistryFromLegacyList();
});

/**
 * The registry indexes storage keys within the one store the app is using. In
 * host mode those keys are the host's, so seeding it with local pipeline names
 * would claim files the host has never heard of.
 */
async function seedRegistryFromLegacyList() {
  if (isHostStorage()) return;

  const count = await pipelineStorageDb.pipeline_registry.count();
  if (count > 0) return;

  const { getAllComponentFilesFromList } =
    await import("@/utils/componentStore");
  const knownPipelines = await getAllComponentFilesFromList(
    USER_PIPELINES_LIST_NAME,
  );

  if (knownPipelines.size === 0) return;

  const pipelineForRegistry = [...knownPipelines.entries()].map(
    ([storageKey]) => ({
      id: crypto.randomUUID(),
      storageKey,
      folderId: ROOT_FOLDER_ID,
    }),
  );

  try {
    /**
     * This code may be revisited to ensure stability and performance.
     */
    pipelineForRegistry.forEach(async (row) => {
      await pipelineStorageDb.pipeline_registry.upsert(row.id, row);
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
}

import { Dexie, type EntityTable } from "dexie";

import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import {
  type FolderEntry,
  type PipelineMigration,
  type PipelineMigrationAttempt,
  type PipelineRegistryEntry,
  ROOT_FOLDER_ID,
} from "./types";

export const pipelineStorageDb = new Dexie("tangle_pipelines") as Dexie & {
  pipeline_registry: EntityTable<PipelineRegistryEntry, "id">;
  folders: EntityTable<FolderEntry, "id">;
  pipeline_migrations: EntityTable<PipelineMigration, "key">;
  pipeline_migration_attempts: EntityTable<PipelineMigrationAttempt, "localId">;
};

pipelineStorageDb.version(1).stores({
  pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
  folders: "id, parentId",
});

pipelineStorageDb.version(2).stores({
  pipeline_migrations: "key",
});

pipelineStorageDb.version(3).stores({
  pipeline_migration_attempts: "localId",
});

pipelineStorageDb.on("ready", async (db) => {
  // The ready callback's connection stays usable across the dynamic import
  // while ordinary callers wait for registry hydration to finish.
  const registry = db.table<PipelineRegistryEntry>("pipeline_registry");
  const migrations = db.table<PipelineMigration>("pipeline_migrations");
  const count = await registry.count();
  if (count > 0) return;

  const { getAllComponentFilesFromList } =
    await import("@/utils/componentStore");
  const knownPipelines = await getAllComponentFilesFromList(
    USER_PIPELINES_LIST_NAME,
  );

  if (knownPipelines.size === 0) return;

  const pipelineForRegistry = await Promise.all(
    [...knownPipelines.keys()].map(async (storageKey) => ({
      id: crypto.randomUUID(),
      storageKey,
      folderId: ROOT_FOLDER_ID,
      ...((await migrations.get(`name:${storageKey}`)) && {
        recreatedAfterMigration: true,
      }),
    })),
  );

  try {
    await registry.bulkPut(pipelineForRegistry);
  } catch (e) {
    console.error(e);
    throw e;
  }
});

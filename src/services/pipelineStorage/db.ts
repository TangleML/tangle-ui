import { Dexie, type EntityTable, type Table } from "dexie";

import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { currentStorageKind } from "./storageMode";
import {
  type CachedPipelineSpec,
  type FolderEntry,
  type HostMigrationRecord,
  type PendingPipelineWrite,
  type PipelineRegistryEntry,
  type PipelineStorageKind,
  ROOT_FOLDER_ID,
} from "./types";

export type PipelineStorageDb = Dexie & {
  pipeline_registry: EntityTable<PipelineRegistryEntry, "id">;
  folders: EntityTable<FolderEntry, "id">;
  pipeline_specs: Table<CachedPipelineSpec, [PipelineStorageKind, string]>;
  host_migration: EntityTable<HostMigrationRecord, "id">;
  pending_writes: Table<PendingPipelineWrite, [PipelineStorageKind, string]>;
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
      .filter((folder) => folder.driverConfig.driverType === "backend")
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

pipelineStorageDb.version(5).stores({
  pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
  folders: "id, parentId",
  pipeline_specs: "storageKey",
  host_migration: "id",
});

/**
 * The spec cache is keyed by store as well, and a primary key cannot be changed
 * in place, so the table is dropped here and remade in the next version. It
 * holds nothing that is not re-readable.
 */
pipelineStorageDb.version(6).stores({ pipeline_specs: null });

pipelineStorageDb
  .version(7)
  .stores({
    pipeline_registry:
      "id, storage, folderId, &[storage+storageKey], [storage+folderId], [storage+folderId+storageKey]",
    folders: "id, parentId",
    pipeline_specs: "[storage+storageKey]",
    host_migration: "id",
  })
  .upgrade(async (tx) => {
    /**
     * Rows predating this version do not say which store they describe, and
     * both stores used the same root folder id. Only a host-provided store
     * reports a `contentVersion`, which makes the two tellable apart where it
     * matters; a row filed in a folder can only be the browser's, because a
     * store that keys pipelines itself has no folders.
     */
    await tx
      .table<PipelineRegistryEntry>("pipeline_registry")
      .toCollection()
      .modify((entry) => {
        const isBackendRow =
          entry.folderId === ROOT_FOLDER_ID &&
          entry.contentVersion !== undefined;
        entry.storage = isBackendRow ? "backend" : "local";
      });
  });

/**
 * The value naming the store changed when pipelines moved onto the configured
 * backend. A row still saying "host" is invisible to every lookup, which scopes
 * itself to the store in use — but its id still occupies the primary key, so
 * the next listing tries to add the same pipeline again and the collision takes
 * the whole page down rather than one row.
 */
pipelineStorageDb.version(8).upgrade(async (tx) => {
  await tx.table("pipeline_specs").clear();

  const registry = tx.table<PipelineRegistryEntry>("pipeline_registry");
  const rows = await registry.toArray();
  const claimed = new Set(
    rows
      .filter((row) => row.storage === "backend")
      .map((row) => row.storageKey),
  );

  for (const row of rows) {
    if ((row.storage as string) !== "host") continue;

    /**
     * A listing that got part way through before the collision left rows under
     * both names. The one written since is the one the backend just described.
     */
    if (claimed.has(row.storageKey)) {
      await registry.delete(row.id);
      continue;
    }

    await registry.update(row.id, { storage: "backend" });
    claimed.add(row.storageKey);
  }
});

/**
 * Edits a store would not take have to outlive the editor that made them: the
 * most likely next thing someone does is leave the page to go and fix the
 * connection, and that must not be what loses the work.
 */
pipelineStorageDb.version(9).stores({
  pending_writes: "[storage+storageKey]",
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
  if (currentStorageKind() === "backend") return;

  const seeded = await pipelineStorageDb.pipeline_registry
    .where("storage")
    .equals("local")
    .count();
  if (seeded > 0) return;

  const { getAllComponentFilesFromList } =
    await import("@/utils/componentStore");
  const knownPipelines = await getAllComponentFilesFromList(
    USER_PIPELINES_LIST_NAME,
  );

  if (knownPipelines.size === 0) return;

  await pipelineStorageDb.pipeline_registry.bulkAdd(
    [...knownPipelines.keys()].map((storageKey) => ({
      id: crypto.randomUUID(),
      storage: "local" as const,
      storageKey,
      folderId: ROOT_FOLDER_ID,
    })),
  );
}

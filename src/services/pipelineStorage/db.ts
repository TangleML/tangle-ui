import { Dexie, type EntityTable } from "dexie";

import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import {
  type FolderEntry,
  type PipelineRegistryEntry,
  ROOT_FOLDER_ID,
} from "./types";

export const pipelineStorageDb = new Dexie("tangle_pipelines") as Dexie & {
  pipeline_registry: EntityTable<PipelineRegistryEntry, "id">;
  folders: EntityTable<FolderEntry, "id">;
};

pipelineStorageDb.version(1).stores({
  pipeline_registry: "id, &storageKey, folderId, [folderId+storageKey]",
  folders: "id, parentId",
});

pipelineStorageDb.on("ready", async () => {
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
});

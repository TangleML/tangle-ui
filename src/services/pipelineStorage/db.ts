import { Dexie, type EntityTable } from "dexie";

import { getAllComponentFilesFromList } from "@/utils/componentStore";
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

const knownPipelines = await getAllComponentFilesFromList(
  USER_PIPELINES_LIST_NAME,
);

pipelineStorageDb.on("populate", async (tx) => {
  await tx.table("pipeline_registry").bulkAdd(
    [...knownPipelines.entries()].map(([storageKey, _entry]) => ({
      id: crypto.randomUUID(),
      storageKey: storageKey,
      folderId: ROOT_FOLDER_ID,
    })),
  );
});

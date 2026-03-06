import { Dexie, type EntityTable } from "dexie";

import type { PipelineFolder, PipelineFolderAssignment } from "../types";

/**
 * Extend the shared oasis-app DB with pipeline folder tables.
 * Dexie accumulates .version() calls on the same instance before the DB opens.
 *
 * TODO: Refine persistence layer
 */
const PipelineFoldersDB = new Dexie("oasis-app") as Dexie & {
  pipeline_folders: EntityTable<PipelineFolder, "id">;
  pipeline_folder_assignments: EntityTable<
    PipelineFolderAssignment,
    "pipelineName"
  >;
};

PipelineFoldersDB.version(2).stores({
  component_libraries: "id, &name",
  pipeline_folders: "id, parentId",
  pipeline_folder_assignments: "pipelineName, folderId",
});

export async function getChildFolders(
  parentId: string | null,
): Promise<PipelineFolder[]> {
  let folders: PipelineFolder[];
  if (parentId === null) {
    folders = await PipelineFoldersDB.pipeline_folders
      .filter((f) => f.parentId === null)
      .toArray();
  } else {
    folders = await PipelineFoldersDB.pipeline_folders
      .where("parentId")
      .equals(parentId)
      .toArray();
  }
  return folders.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/**
 * Walks the parentId chain to build the breadcrumb path from root to the given folder.
 */
export async function getFolderPath(
  folderId: string | null,
): Promise<PipelineFolder[]> {
  if (folderId === null) return [];

  const path: PipelineFolder[] = [];
  let currentId: string | null = folderId;

  while (currentId !== null) {
    const folder: PipelineFolder | undefined =
      await PipelineFoldersDB.pipeline_folders.get(currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }

  return path;
}

export async function createFolder(
  name: string,
  parentId: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  await PipelineFoldersDB.pipeline_folders.add({
    id,
    name,
    parentId,
    createdAt: Date.now(),
  });
  return id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await PipelineFoldersDB.pipeline_folders.update(id, { name });
}

/**
 * Recursively deletes a folder and all its descendants.
 * Pipelines assigned to deleted folders are moved back to root (assignment removed).
 */
export async function deleteFolder(id: string): Promise<void> {
  const descendantIds = await collectDescendantIds(id);
  const allIds = [id, ...descendantIds];

  await PipelineFoldersDB.transaction(
    "rw",
    PipelineFoldersDB.pipeline_folders,
    PipelineFoldersDB.pipeline_folder_assignments,
    async () => {
      await PipelineFoldersDB.pipeline_folder_assignments
        .where("folderId")
        .anyOf(allIds)
        .delete();
      await PipelineFoldersDB.pipeline_folders.bulkDelete(allIds);
    },
  );
}

async function collectDescendantIds(parentId: string): Promise<string[]> {
  const children = await PipelineFoldersDB.pipeline_folders
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

/**
 * Returns pipeline names assigned to a specific folder.
 * For root (folderId=null), returns names that ARE assigned (so the caller can exclude them).
 */
export async function getPipelineNamesInFolder(
  folderId: string | null,
): Promise<Set<string>> {
  if (folderId === null) {
    const allAssigned =
      await PipelineFoldersDB.pipeline_folder_assignments.toArray();
    return new Set(allAssigned.map((a) => a.pipelineName));
  }

  const assignments = await PipelineFoldersDB.pipeline_folder_assignments
    .where("folderId")
    .equals(folderId)
    .toArray();
  return new Set(assignments.map((a) => a.pipelineName));
}

export async function assignPipelineToFolder(
  pipelineName: string,
  folderId: string,
): Promise<void> {
  await PipelineFoldersDB.pipeline_folder_assignments.put({
    pipelineName,
    folderId,
  });
}

export async function movePipelineToRoot(pipelineName: string): Promise<void> {
  await PipelineFoldersDB.pipeline_folder_assignments.delete(pipelineName);
}

export async function moveFolder(
  id: string,
  newParentId: string | null,
): Promise<void> {
  await PipelineFoldersDB.pipeline_folders.update(id, {
    parentId: newParentId,
  });
}

export async function toggleFolderFavorite(id: string): Promise<boolean> {
  const folder = await PipelineFoldersDB.pipeline_folders.get(id);
  if (!folder) throw new Error("Folder not found");
  const newValue = !folder.favorite;
  await PipelineFoldersDB.pipeline_folders.update(id, { favorite: newValue });
  return newValue;
}

export async function getFavoriteFolders(): Promise<PipelineFolder[]> {
  const favorites = await PipelineFoldersDB.pipeline_folders
    .filter((f) => f.favorite === true)
    .toArray();
  return favorites.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export async function getPipelineFolderAssignment(
  pipelineName: string,
): Promise<string | null> {
  const assignment =
    await PipelineFoldersDB.pipeline_folder_assignments.get(pipelineName);
  return assignment?.folderId ?? null;
}

export async function getAllFolders(): Promise<PipelineFolder[]> {
  return PipelineFoldersDB.pipeline_folders.toArray();
}

import { Dexie, type EntityTable } from "dexie";

import type { ConnectedFolderRecord } from "../types";

const ConnectedFoldersDB = new Dexie("oasis-app") as Dexie & {
  connected_folders: EntityTable<ConnectedFolderRecord, "id">;
};

ConnectedFoldersDB.version(5).stores({
  component_libraries: "id, &name",
  pipeline_folders: "id, parentId",
  pipeline_folder_assignments: "pipelineName, folderId",
  connected_folders: "id, parentId",
  file_handle_associations: "pipelineName",
});

export async function addConnectedFolder(
  handle: FileSystemDirectoryHandle,
): Promise<string> {
  const existing = await ConnectedFoldersDB.connected_folders.toArray();
  for (const record of existing) {
    const isSame = await record.handle.isSameEntry(handle);
    if (isSame) return record.id;
  }

  const id = crypto.randomUUID();
  await ConnectedFoldersDB.connected_folders.add({
    id,
    name: handle.name,
    handle,
    connectedAt: Date.now(),
    parentId: null,
  });
  return id;
}

export async function removeConnectedFolder(id: string): Promise<void> {
  await ConnectedFoldersDB.connected_folders.delete(id);
}

export type PermissionStatus = "granted" | "denied" | "prompt";

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionStatus> {
  const opts = { mode: "readwrite" as const };
  const status = await handle.queryPermission(opts);
  if (status === "granted") return "granted";
  return status;
}

export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const status = await handle.requestPermission({ mode: "readwrite" as const });
  return status === "granted";
}

export async function getConnectedFoldersInParent(
  parentId: string | null,
): Promise<ConnectedFolderRecord[]> {
  let folders: ConnectedFolderRecord[];
  if (parentId === null) {
    folders = await ConnectedFoldersDB.connected_folders
      .filter((f) => f.parentId === null)
      .toArray();
  } else {
    folders = await ConnectedFoldersDB.connected_folders
      .where("parentId")
      .equals(parentId)
      .toArray();
  }
  return folders.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export async function moveConnectedFolder(
  id: string,
  newParentId: string | null,
): Promise<void> {
  if (id === newParentId) return;

  await ConnectedFoldersDB.connected_folders.update(id, {
    parentId: newParentId,
  });
}

export async function getConnectedFolderById(
  id: string,
): Promise<ConnectedFolderRecord | undefined> {
  return ConnectedFoldersDB.connected_folders.get(id);
}

export interface LocalPipelineFile {
  name: string;
  fileName: string;
  handle: FileSystemFileHandle;
  lastModified: number;
}

const PIPELINE_YAML_PATTERN = /\.pipeline\.component\.ya?ml$/i;

export async function scanForPipelineFiles(
  dirHandle: FileSystemDirectoryHandle,
): Promise<LocalPipelineFile[]> {
  const files: LocalPipelineFile[] = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind !== "file") continue;
    if (!PIPELINE_YAML_PATTERN.test(entry.name)) continue;

    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    const pipelineName = entry.name.replace(/\.pipeline\.ya?ml$/i, "");
    files.push({
      name: pipelineName,
      fileName: entry.name,
      handle: fileHandle,
      lastModified: file.lastModified,
    });
  }

  return files.sort((a, b) => b.lastModified - a.lastModified);
}

import { Dexie, type EntityTable } from "dexie";

interface FileHandleAssociation {
  pipelineName: string;
  handle: FileSystemFileHandle;
}

const FileHandleDB = new Dexie("oasis-app") as Dexie & {
  file_handle_associations: EntityTable<FileHandleAssociation, "pipelineName">;
};

// todo: take DB under control.
FileHandleDB.version(5).stores({
  component_libraries: "id, &name",
  pipeline_folders: "id, parentId",
  pipeline_folder_assignments: "pipelineName, folderId",
  connected_folders: "id, parentId",
  file_handle_associations: "pipelineName",
});

export async function storeFileHandle(
  pipelineName: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  await FileHandleDB.file_handle_associations.put({ pipelineName, handle });
}

async function getFileHandle(
  pipelineName: string,
): Promise<FileSystemFileHandle | null> {
  const record = await FileHandleDB.file_handle_associations.get(pipelineName);
  return record?.handle ?? null;
}

/**
 * Writes YAML content back to the OS file associated with the pipeline.
 * Best-effort: returns false if no handle exists or permission is not granted.
 */
export async function writeToFileHandle(
  pipelineName: string,
  yamlText: string,
): Promise<boolean> {
  const handle = await getFileHandle(pipelineName);
  if (!handle) return false;

  const permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") return false;

  const writable = await handle.createWritable();
  await writable.write(yamlText);
  await writable.close();
  return true;
}

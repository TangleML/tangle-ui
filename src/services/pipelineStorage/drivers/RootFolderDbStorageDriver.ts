import {
  deleteComponentFileFromList,
  getAllComponentFilesFromList,
  getComponentFileFromList,
  renameComponentFileInList,
  writeComponentToFileListFromText,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import type { PipelineFileDescriptor, PipelineStorageDriver } from "../types";

export interface RootFolderDbDriverConfig {
  driverType: "root-indexdb";
}

const LIST_NAME = USER_PIPELINES_LIST_NAME;

export class RootFolderDbStorageDriver implements PipelineStorageDriver {
  readonly type: string = "root-indexdb";
  readonly allowsMoveIn = true;
  readonly allowsMoveOut = true;

  async list(): Promise<PipelineFileDescriptor[]> {
    const files = await getAllComponentFilesFromList(LIST_NAME);
    const descriptors: PipelineFileDescriptor[] = [];

    for (const [key, entry] of files) {
      descriptors.push({
        storageKey: key,
        createdAt: entry.creationTime,
        modifiedAt: entry.modificationTime,
      });
    }

    return descriptors;
  }

  async read(storageKey: string): Promise<string> {
    const entry = await getComponentFileFromList(LIST_NAME, storageKey);
    if (!entry) {
      throw new Error(`Pipeline "${storageKey}" not found in IndexDB`);
    }
    return entry.componentRef.text;
  }

  async write(storageKey: string, content: string): Promise<void> {
    await writeComponentToFileListFromText(LIST_NAME, storageKey, content);
  }

  async rename(oldStorageKey: string, newStorageKey: string): Promise<void> {
    await renameComponentFileInList(LIST_NAME, oldStorageKey, newStorageKey);
  }

  async delete(storageKey: string): Promise<void> {
    await deleteComponentFileFromList(LIST_NAME, storageKey);
  }

  async hasKey(storageKey: string): Promise<boolean> {
    const entry = await getComponentFileFromList(LIST_NAME, storageKey);
    return entry != null;
  }
}

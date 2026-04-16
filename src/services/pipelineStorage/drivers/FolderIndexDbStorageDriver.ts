import { getComponentFileFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import {
  findByFolderAndStorageKey,
  getAllByFolderId,
} from "../pipelineRegistry";
import type { PipelineFileDescriptor } from "../types";
import { RootFolderDbStorageDriver } from "./RootFolderDbStorageDriver";

export interface FolderIndexDbDriverConfig {
  driverType: "folder-indexdb";
  folderId: string;
}

const LIST_NAME = USER_PIPELINES_LIST_NAME;

export class FolderIndexDbStorageDriver extends RootFolderDbStorageDriver {
  override readonly type = "folder-indexdb";

  constructor(private readonly folderId: string) {
    super();
  }

  override async list(): Promise<PipelineFileDescriptor[]> {
    const entries = await getAllByFolderId(this.folderId);
    const descriptors: PipelineFileDescriptor[] = [];

    for (const entry of entries) {
      const file = await getComponentFileFromList(LIST_NAME, entry.storageKey);
      if (!file) continue;

      descriptors.push({
        storageKey: entry.storageKey,
        createdAt: file.creationTime,
        modifiedAt: file.modificationTime,
      });
    }

    return descriptors;
  }

  override async hasKey(storageKey: string): Promise<boolean> {
    const entry = await findByFolderAndStorageKey(this.folderId, storageKey);
    return entry != null;
  }
}

import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { PipelineFolder } from "@/services/pipelineStorage/PipelineFolder";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";

import { TOUR_FOLDER_ID } from "./constants";
import { SessionStoragePipelineDriver } from "./SessionStoragePipelineDriver";
import { TourPipelineFolder } from "./TourPipelineFolder";

export class TourPipelineStorageService extends PipelineStorageService {
  constructor() {
    super();
    this.rootFolder = new TourPipelineFolder({
      id: TOUR_FOLDER_ID,
      name: "Tour",
      parentId: null,
      driver: new SessionStoragePipelineDriver(),
    });
  }

  override async findPipelineById(id: string): Promise<PipelineFile> {
    const file = await this.rootFolder.findFile(id);
    if (!file) {
      throw new Error(`Tour pipeline not found: ${id}`);
    }
    return file;
  }

  override async resolvePipelineByName(
    name: string,
  ): Promise<PipelineFile | undefined> {
    return this.rootFolder.findFile(name);
  }

  override async findFolderById(id: string): Promise<PipelineFolder> {
    if (id === TOUR_FOLDER_ID || id === this.rootFolder.id) {
      return this.rootFolder;
    }
    throw new Error(`Folder not available in tour mode: ${id}`);
  }

  override async getAllFolders(): Promise<PipelineFolder[]> {
    return [this.rootFolder];
  }

  override async getFavoriteFolders(): Promise<PipelineFolder[]> {
    return [];
  }
}

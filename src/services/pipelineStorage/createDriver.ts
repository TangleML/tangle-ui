import { FolderIndexDbStorageDriver } from "./drivers/FolderIndexDbStorageDriver";
import { LocalFileSystemDriver } from "./drivers/LocalFileSystemDriver";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import type { DriverConfig, PipelineStorageDriver } from "./types";

export function createDriver(config: DriverConfig): PipelineStorageDriver {
  switch (config.driverType) {
    case "root-indexdb":
      return new RootFolderDbStorageDriver();
    case "folder-indexdb":
      return new FolderIndexDbStorageDriver(config.folderId);
    case "local-fs":
      return new LocalFileSystemDriver(config.handle);
  }
}

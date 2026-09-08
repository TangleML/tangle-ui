import { getGoogleDriveAuth } from "../googleDrive/GoogleDriveAuthService"; // google-drive
import { GoogleDriveStorageDriver } from "../googleDrive/GoogleDriveStorageDriver"; // google-drive
import { FolderIndexDbStorageDriver } from "./drivers/FolderIndexDbStorageDriver";
import { HostStorageDriver } from "./drivers/HostStorageDriver";
import { LocalFileSystemDriver } from "./drivers/LocalFileSystemDriver";
import { RootFolderDbStorageDriver } from "./drivers/RootFolderDbStorageDriver";
import { getStorageHost } from "./storageMode";
import type { DriverConfig, PipelineStorageDriver } from "./types";

export function createDriver(config: DriverConfig): PipelineStorageDriver {
  switch (config.driverType) {
    case "root-indexdb":
      return new RootFolderDbStorageDriver();
    case "folder-indexdb":
      return new FolderIndexDbStorageDriver(config.folderId);
    case "local-fs":
      return new LocalFileSystemDriver(config.handle);
    case "host": {
      const host = getStorageHost();
      if (!host) {
        throw new Error(
          "Host-provided pipeline storage is not available on this page",
        );
      }
      return new HostStorageDriver(host);
    }
    case "google-drive": // google-drive
      return new GoogleDriveStorageDriver(
        config.folderId,
        getGoogleDriveAuth(),
      );
  }
}

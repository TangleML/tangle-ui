import type { GoogleDriveDriverConfig } from "../googleDrive/types"; // google-drive
import type { FolderIndexDbDriverConfig } from "./drivers/FolderIndexDbStorageDriver";
import type { LocalFileSystemDriverConfig } from "./drivers/LocalFileSystemDriver";
import type { RootFolderDbDriverConfig } from "./drivers/RootFolderDbStorageDriver";

export const ROOT_FOLDER_ID = "__root__";

export interface PipelineFileDescriptor {
  storageKey: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

export type PermissionStatus = "granted" | "denied" | "prompt";

export interface DriverPermissions {
  check(): Promise<PermissionStatus>;
  request(): Promise<boolean>;
}

export interface PipelineStorageDriver {
  readonly type: string;
  readonly permissions?: DriverPermissions;
  readonly allowsMoveIn: boolean;
  readonly allowsMoveOut: boolean;
  list(): Promise<PipelineFileDescriptor[]>;
  read(storageKey: string): Promise<string>;
  write(storageKey: string, content: string): Promise<void>;
  rename(oldStorageKey: string, newStorageKey: string): Promise<void>;
  delete(storageKey: string): Promise<void>;
  hasKey(storageKey: string): Promise<boolean>;
}

export type DriverConfig =
  | RootFolderDbDriverConfig
  | FolderIndexDbDriverConfig
  | LocalFileSystemDriverConfig
  | GoogleDriveDriverConfig; // google-drive

export interface PipelineRegistryEntry {
  id: string;
  storageKey: string;
  folderId: string;
}

export interface FolderEntry {
  id: string;
  name: string;
  parentId: string | null;
  driverConfig: DriverConfig;
  createdAt: number;
  favorite?: boolean;
}
export interface PipelineRef {
  name: string;
  fileId?: string;
}
export const FoldersQueryKeys = {
  All: () => ["pipeline-folders"] as const,
  Children: (parentId: string | null) =>
    ["pipeline-folders", "children", parentId] as const,
  Breadcrumbs: (folderId: string | null) =>
    ["pipeline-folders", "breadcrumbs", folderId] as const,
  Pipelines: (folderId: string | null) =>
    ["pipeline-folders", "pipelines", folderId] as const,
  Favorites: () => ["pipeline-folders", "favorites"] as const,
} as const;

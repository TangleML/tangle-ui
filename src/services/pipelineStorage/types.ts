import { normalizeBackendUrl } from "@/utils/backendIdentity";

import type { GoogleDriveDriverConfig } from "../googleDrive/types"; // google-drive
import { normalizePipelineId } from "../pipelineId";
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
  readonly ownerId?: string;
  readonly type: string;
  readonly permissions?: DriverPermissions;
  readonly allowsMoveIn: boolean;
  readonly allowsMoveOut: boolean;
  readonly canEdit?: boolean;
  readonly editingError?: Error;
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
export interface RemotePipelineRef {
  source: "remote";
  backendUrl: string;
  pipelineId: string;
}

export interface PipelineMigrationAttempt {
  localId: string;
  backendUrl: string;
  content: string;
  keepLocalCopy?: boolean;
}

export interface PipelineMigration {
  localId?: string;
  key: string;
  remote: RemotePipelineRef;
  name: string;
}

export interface RemotePipelineDraftRef {
  source: "draft";
  backendUrl: string;
  draftId: string;
  name: string;
  provisionalName?: boolean;
}

export type EditorPipelineRef =
  PipelineRef | RemotePipelineRef | RemotePipelineDraftRef;

export function isRemotePipelineDraftRef(
  ref: EditorPipelineRef,
): ref is RemotePipelineDraftRef {
  return "source" in ref && ref.source === "draft";
}

export function isRemotePipelineRef(
  ref: EditorPipelineRef,
): ref is RemotePipelineRef {
  return "source" in ref && ref.source === "remote";
}

export function getEditorPipelineIdentity(ref: EditorPipelineRef): string {
  if (isRemotePipelineDraftRef(ref)) {
    return JSON.stringify([
      "remote-pipeline-draft",
      normalizeBackendUrl(ref.backendUrl),
      ref.draftId,
    ]);
  }
  return isRemotePipelineRef(ref)
    ? JSON.stringify([
        "remote-pipeline",
        normalizeBackendUrl(ref.backendUrl),
        normalizePipelineId(ref.pipelineId),
      ])
    : (ref.fileId ?? ref.name);
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

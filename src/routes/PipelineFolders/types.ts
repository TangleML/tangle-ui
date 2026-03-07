export interface PipelineFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  favorite?: boolean;
}

export interface PipelineFolderAssignment {
  pipelineName: string;
  folderId: string;
}

export interface ConnectedFolderRecord {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  connectedAt: number;
  parentId: string | null;
}

export type DragItem = {
  type: "pipeline" | "folder" | "connected-folder";
  id: string;
};

export const ConnectedFoldersQueryKeys = {
  All: () => ["connected-folders"] as const,
  Children: (parentId: string | null) =>
    ["connected-folders", "children", parentId] as const,
  Files: (folderId: string) =>
    ["connected-folders", "files", folderId] as const,
} as const;

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

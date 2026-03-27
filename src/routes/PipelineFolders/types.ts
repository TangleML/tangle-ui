export type DragItem = {
  type: "pipeline" | "folder";
  id: string;
};

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

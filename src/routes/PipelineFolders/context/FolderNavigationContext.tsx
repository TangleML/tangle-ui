import { createContext, useContext } from "react";

export interface PipelineRef {
  name: string;
  fileId?: string;
}

interface FolderNavigationContextType {
  navigateToFolder: (folderId: string | null) => void;
  onPipelineClick?: (pipeline: PipelineRef) => void;
}

const FolderNavigationContext =
  createContext<FolderNavigationContextType | null>(null);

/**
 * Returns the folder navigation context when inside a provider (embedded mode),
 * or null when used standalone with URL-based navigation.
 */
export function useFolderNavigation(): FolderNavigationContextType | null {
  return useContext(FolderNavigationContext);
}

export { FolderNavigationContext };

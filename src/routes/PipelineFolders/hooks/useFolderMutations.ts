import { useMutation, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { getErrorMessage } from "@/utils/string";

import {
  createFolder,
  deleteFolder,
  renameFolder,
  toggleFolderFavorite,
} from "../services/folderStorage";
import { FoldersQueryKeys } from "../types";

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({
      name,
      parentId,
    }: {
      name: string;
      parentId: string | null;
    }) => createFolder(name, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder created", "success");
    },
    onError: (error) => {
      notify("Failed to create folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameFolder(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder renamed", "success");
    },
    onError: (error) => {
      notify("Failed to rename folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify("Folder deleted", "success");
    },
    onError: (error) => {
      notify("Failed to delete folder: " + getErrorMessage(error), "error");
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (id: string) => toggleFolderFavorite(id),
    onSuccess: (isFavorite) => {
      queryClient.invalidateQueries({ queryKey: FoldersQueryKeys.All() });
      notify(
        isFavorite ? "Added to favorites" : "Removed from favorites",
        "success",
      );
    },
    onError: (error) => {
      notify("Failed to update favorite: " + getErrorMessage(error), "error");
    },
  });
}

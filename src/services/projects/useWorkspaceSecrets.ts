import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";

import { WorkspaceSecretsApiError } from "./errors";
import { projectQueryDefaults } from "./queryDefaults";
import type {
  CreateWorkspaceSecretInput,
  ReplaceWorkspaceSecretInput,
} from "./types";
import { WorkspaceSecretsQueryKeys } from "./types";
import {
  createWorkspaceSecret,
  deleteWorkspaceSecret,
  listWorkspaceSecrets,
  replaceWorkspaceSecret,
} from "./workspaceSecretsService";

const failureMessage = (error: Error, fallback: string) =>
  error instanceof WorkspaceSecretsApiError ? error.message : fallback;

export function useWorkspaceSecrets(workspaceId: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: WorkspaceSecretsQueryKeys.All(workspaceId ?? ""),
    queryFn: () => {
      if (!workspaceId) {
        throw new Error("Workspace id is required");
      }
      return listWorkspaceSecrets(workspaceId);
    },
    enabled: configured && available && Boolean(workspaceId),
    ...projectQueryDefaults,
  });
}

function useWorkspaceSecretMutation<TVariables, TData>(
  workspaceId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  fallbackFailure: string,
) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: WorkspaceSecretsQueryKeys.All(workspaceId),
      });
    },
    onError: (error) => {
      notify(failureMessage(error, fallbackFailure), "error");
    },
  });
}

export function useCreateWorkspaceSecret(workspaceId: string) {
  return useWorkspaceSecretMutation(
    workspaceId,
    (input: CreateWorkspaceSecretInput) =>
      createWorkspaceSecret(workspaceId, input),
    "Failed to add secret",
  );
}

export function useReplaceWorkspaceSecret(workspaceId: string) {
  return useWorkspaceSecretMutation(
    workspaceId,
    ({ name, input }: { name: string; input: ReplaceWorkspaceSecretInput }) =>
      replaceWorkspaceSecret(workspaceId, name, input),
    "Failed to replace secret",
  );
}

export function useDeleteWorkspaceSecret(workspaceId: string) {
  return useWorkspaceSecretMutation(
    workspaceId,
    (name: string) => deleteWorkspaceSecret(workspaceId, name),
    "Failed to delete secret",
  );
}

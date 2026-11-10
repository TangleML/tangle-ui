import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { getErrorMessage } from "@/utils/string";

import {
  chooseTokenSecret,
  clearTokenSecret,
  fetchGitHubTokenStatus,
  fetchTokenSecretName,
  listRepositoryGrants,
  revokeRepositoryGrant,
} from "./githubBackendClient";

const TOKEN_STATUS_STALE_MS = 30 * 1000;

const GitHubQueryKeys = {
  All: () => ["github"] as const,
  TokenStatus: (backendUrl: string) =>
    ["github", "token-status", backendUrl] as const,
  Grants: (backendUrl: string) =>
    ["github", "repository-grants", backendUrl] as const,
  TokenSecretName: (backendUrl: string) =>
    ["github", "token-secret-name", backendUrl] as const,
} as const;

export function gitHubTokenStatusQuery(backendUrl: string) {
  return {
    queryKey: GitHubQueryKeys.TokenStatus(backendUrl),
    queryFn: () => fetchGitHubTokenStatus(backendUrl),
    staleTime: TOKEN_STATUS_STALE_MS,
    retry: false,
  };
}

export function useGitHubTokenStatus() {
  const { available, backendUrl } = useBackend();
  return useQuery({
    ...gitHubTokenStatusQuery(backendUrl),
    enabled: available,
    refetchOnMount: "always",
  });
}

export function useTokenSecretName() {
  const { available, backendUrl } = useBackend();
  return useQuery({
    queryKey: GitHubQueryKeys.TokenSecretName(backendUrl),
    queryFn: () => fetchTokenSecretName(backendUrl),
    enabled: available,
    retry: false,
  });
}

export function useRepositoryGrants() {
  const { available, backendUrl } = useBackend();
  return useQuery({
    queryKey: GitHubQueryKeys.Grants(backendUrl),
    queryFn: () => listRepositoryGrants(backendUrl),
    enabled: available,
    retry: false,
  });
}

function useGitHubMutation<TVariables>(
  mutationFn: (backendUrl: string, variables: TVariables) => Promise<void>,
  failure: string,
) {
  const { backendUrl } = useBackend();
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(backendUrl, variables),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: GitHubQueryKeys.All(),
      });
    },
    onError: (error) => {
      notify(`${failure}: ${getErrorMessage(error)}`, "error");
    },
  });
}

export const useChooseTokenSecret = () =>
  useGitHubMutation<string>(chooseTokenSecret, "Couldn't use that secret");

export const useClearTokenSecret = () =>
  useGitHubMutation<void>(clearTokenSecret, "Couldn't stop using the token");

export const useRevokeRepositoryGrant = () =>
  useGitHubMutation<string>(revokeRepositoryGrant, "Couldn't revoke access");

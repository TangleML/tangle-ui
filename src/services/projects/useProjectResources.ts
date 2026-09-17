import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import {
  createProjectResource,
  deleteProjectResource,
  getProjectResource,
  listProjectResources,
  updateProjectResource,
} from "./projectResourcesService";
import type {
  CreateResourceInput,
  ListProjectResourcesParams,
  UpdateResourceInput,
} from "./types";
import { ProjectResourcesQueryKeys, ProjectsQueryKeys } from "./types";

export function useProjectResources(
  projectId: string | undefined,
  params: ListProjectResourcesParams = {},
) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectResourcesQueryKeys.List(projectId ?? "", params),
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project id is required");
      }
      return listProjectResources(projectId, params);
    },
    enabled: configured && available && Boolean(projectId),
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

export function useProjectResource(
  projectId: string | undefined,
  resourceId: string | undefined,
) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectResourcesQueryKeys.Id(projectId ?? "", resourceId ?? ""),
    queryFn: () => {
      if (!projectId || !resourceId) {
        throw new Error("Project id and resource id are required");
      }
      return getProjectResource(projectId, resourceId);
    },
    enabled:
      configured && available && Boolean(projectId) && Boolean(resourceId),
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

export function useCreateProjectResource(projectId: string) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (input: CreateResourceInput) =>
      createProjectResource(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ProjectResourcesQueryKeys.All(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(projectId),
      });
    },
    onError: () => {
      notify("Failed to create resource", "error");
    },
  });
}

export function useUpdateProjectResource(projectId: string) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({
      resourceId,
      input,
    }: {
      resourceId: string;
      input: UpdateResourceInput;
    }) => updateProjectResource(projectId, resourceId, input),
    onSuccess: (_resource, { resourceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ProjectResourcesQueryKeys.All(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectResourcesQueryKeys.Id(projectId, resourceId),
      });
    },
    onError: () => {
      notify("Failed to update resource", "error");
    },
  });
}

export function useDeleteProjectResource(projectId: string) {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (resourceId: string) =>
      deleteProjectResource(projectId, resourceId),
    onSuccess: (_result, resourceId) => {
      void queryClient.invalidateQueries({
        queryKey: ProjectResourcesQueryKeys.All(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectResourcesQueryKeys.Id(projectId, resourceId),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(projectId),
      });
    },
    onError: () => {
      notify("Failed to delete resource", "error");
    },
  });
}

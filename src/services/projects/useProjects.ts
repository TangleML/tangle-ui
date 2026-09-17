import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

import { ProjectsApiError } from "./errors";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./projectsService";
import type {
  CreateProjectInput,
  ListProjectsParams,
  UpdateProjectInput,
} from "./types";
import { ProjectsQueryKeys } from "./types";

const MAX_RETRIES = 3;

/**
 * A 4xx is the backend's settled answer, so retrying only delays it: without
 * this, a deleted project's url sits on a spinner for the length of three
 * backoffs before it can say the project is gone.
 */
function retryUnlessRefused(failureCount: number, error: Error) {
  if (
    error instanceof ProjectsApiError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function useProjects(params: ListProjectsParams = {}) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectsQueryKeys.List(params),
    queryFn: () => listProjects(params),
    enabled: configured && available,
    retry: retryUnlessRefused,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

export function useProject(id: string | undefined) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectsQueryKeys.Id(id ?? ""),
    queryFn: () => {
      if (!id) {
        throw new Error("Project id is required");
      }
      return getProject(id);
    },
    enabled: configured && available && Boolean(id),
    retry: retryUnlessRefused,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.All(),
      });
    },
    onError: () => {
      notify("Failed to create project", "error");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      updateProject(id, input),
    onSuccess: (_project, { id }) => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.All(),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(id),
      });
    },
    onError: () => {
      notify("Failed to update project", "error");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const notify = useToastNotification();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.All(),
      });
      void queryClient.invalidateQueries({
        queryKey: ProjectsQueryKeys.Id(id),
      });
    },
    onError: () => {
      notify("Failed to delete project", "error");
    },
  });
}

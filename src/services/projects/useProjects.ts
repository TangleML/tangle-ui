import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { MINUTES } from "@/utils/constants";

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

export function useProjects(params: ListProjectsParams = {}) {
  const { configured, available } = useBackend();

  return useQuery({
    queryKey: ProjectsQueryKeys.List(params),
    queryFn: () => listProjects(params),
    enabled: configured && available,
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

import { useState } from "react";

import type { ProjectSummary, Workspace } from "@/services/projects/types";
import { useReachableProjects } from "@/services/projects/useReachableProjects";

export const NEW_PROJECT = "new-project";

export function useTangentDestinationChoice(
  attributed: readonly ProjectSummary[],
  workspaces: readonly Workspace[] | undefined,
) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const reachable = useReachableProjects();

  const attributedIds = new Set(attributed.map((project) => project.id));
  const others = reachable.projects.filter(
    (project) => !attributedIds.has(project.id),
  );
  const listed = [...attributed, ...others];
  const hasNoProjects = !reachable.isPending && listed.length === 0;
  const workspaceNames =
    new Set(listed.map((project) => project.workspaceId)).size > 1
      ? new Map(workspaces?.map((workspace) => [workspace.id, workspace.name]))
      : undefined;

  const needle = query.trim().toLowerCase();
  const matches = (project: ProjectSummary) =>
    project.name.toLowerCase().includes(needle);
  const attributedMatches = attributed.filter(matches);
  const otherMatches = others.filter(matches);
  const visible = [...attributedMatches, ...otherMatches].map(
    (project) => project.id,
  );

  const picked =
    selected === NEW_PROJECT || (selected && visible.includes(selected))
      ? selected
      : hasNoProjects
        ? NEW_PROJECT
        : undefined;

  return {
    query,
    setQuery,
    hasProjects: listed.length > 0,
    hasNoMatches: listed.length > 0 && visible.length === 0,
    attributedMatches,
    otherMatches,
    workspaceNames,
    isLoading: reachable.isPending,
    loadError: reachable.error,
    picked,
    toggle: (option: string) =>
      setSelected(picked === option ? undefined : option),
  };
}

export type TangentDestinationChoice = ReturnType<
  typeof useTangentDestinationChoice
>;

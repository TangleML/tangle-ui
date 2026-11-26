import type { ProjectSummary, Workspace } from "@/services/projects/types";

interface WorkspaceProjects {
  workspaceId: string;
  title: string;
  projects: ProjectSummary[];
}

const UNKNOWN_WORKSPACE_TITLE = "Other workspace";

/**
 * The projects of each workspace that has any, by workspace name, each
 * workspace's projects in the order given. A project of a workspace not among
 * those known — one shared from a workspace the caller can't see — comes
 * last, under a title of its own.
 */
export function groupProjectsByWorkspace(
  projects: readonly ProjectSummary[],
  workspaces: readonly Workspace[],
): WorkspaceProjects[] {
  const names = new Map(workspaces.map(({ id, name }) => [id, name]));
  const byWorkspace = new Map<string, ProjectSummary[]>();
  for (const project of projects) {
    byWorkspace.set(project.workspaceId, [
      ...(byWorkspace.get(project.workspaceId) ?? []),
      project,
    ]);
  }

  const sections = [...byWorkspace].map(([workspaceId, grouped]) => ({
    workspaceId,
    title: names.get(workspaceId) ?? UNKNOWN_WORKSPACE_TITLE,
    projects: grouped,
  }));
  const known = sections
    .filter(({ workspaceId }) => names.has(workspaceId))
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const unknown = sections.filter(({ workspaceId }) => !names.has(workspaceId));

  return [...known, ...unknown];
}

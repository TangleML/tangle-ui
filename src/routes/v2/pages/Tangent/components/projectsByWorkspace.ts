import type { ProjectSummary, Workspace } from "@/services/projects/types";

interface WorkspaceProjects {
  workspaceId: string;
  title: string;
  projects: ProjectSummary[];
}

const OTHER_WORKSPACE_ID = "other-workspace";
const OTHER_WORKSPACE_TITLE = "Other workspace";

/**
 * The projects of each workspace that has any, by workspace name, each
 * workspace's projects in the order given. Projects of workspaces not among
 * those known — shared from workspaces the caller can't see — come last,
 * together under one title.
 */
export function groupProjectsByWorkspace(
  projects: readonly ProjectSummary[],
  workspaces: readonly Workspace[],
): WorkspaceProjects[] {
  const names = new Map(workspaces.map(({ id, name }) => [id, name]));
  const known = [...Map.groupBy(projects, ({ workspaceId }) => workspaceId)]
    .flatMap(([workspaceId, grouped]) => {
      const title = names.get(workspaceId);
      return title === undefined
        ? []
        : [{ workspaceId, title, projects: grouped }];
    })
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const other = projects.filter(({ workspaceId }) => !names.has(workspaceId));

  return other.length === 0
    ? known
    : [
        ...known,
        {
          workspaceId: OTHER_WORKSPACE_ID,
          title: OTHER_WORKSPACE_TITLE,
          projects: other,
        },
      ];
}

import type { Workspace } from "@/services/projects/types";

import type { TeamSummary } from "./types";

const WORKSPACE_TEAM_ID_KEY = "teamId";

export function resolveTeamId(
  workspace: Pick<Workspace, "metadata">,
): string | null {
  const teamId = workspace.metadata?.[WORKSPACE_TEAM_ID_KEY];
  if (typeof teamId !== "string") return null;
  return teamId.trim() || null;
}

export function teamOfWorkspace(
  workspace: Pick<Workspace, "metadata" | "name">,
): TeamSummary | null {
  const teamId = resolveTeamId(workspace);
  return teamId ? { id: teamId, label: workspace.name } : null;
}

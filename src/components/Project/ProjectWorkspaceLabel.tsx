import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { getTeamImpersonationHeaderName } from "@/config/teamImpersonation";
import type { Project } from "@/services/projects/types";
import { useWorkspace } from "@/services/projects/useWorkspaces";
import type { TeamMembership } from "@/services/teams/types";
import { useUserTeams } from "@/services/teams/useUserTeams";
import { resolveTeamId } from "@/services/teams/workspaceTeam";

function roleLabel(
  memberships: TeamMembership[] | undefined,
  teamId: string,
): string | undefined {
  if (!memberships) return undefined;
  const membership = memberships.find((one) => one.teamId === teamId);
  if (!membership) return "Not a member";
  if (membership.roles.includes("editor")) return "Editor";
  if (membership.roles.includes("reader")) return "Reader";
  return "No access";
}

export function ProjectWorkspaceLabel({ project }: { project: Project }) {
  const { data: workspace } = useWorkspace(project.workspaceId);
  const teamId =
    workspace && getTeamImpersonationHeaderName() !== null
      ? resolveTeamId(workspace)
      : null;
  const { data: memberships } = useUserTeams({ enabled: teamId !== null });

  if (!workspace) return null;

  const role = teamId ? roleLabel(memberships, teamId) : undefined;

  return (
    <InlineStack
      gap="1"
      wrap="nowrap"
      className="min-w-0"
      data-testid="project-workspace"
    >
      <Icon
        name="Shapes"
        size="xs"
        aria-label="Workspace"
        className="shrink-0 text-muted-foreground"
      />
      <Text size="xs" tone="subdued" className="truncate">
        {workspace.name}
      </Text>
      {role && (
        <Text
          size="xs"
          tone="subdued"
          className="shrink-0 whitespace-nowrap"
          data-testid="project-team-role"
        >
          {`· ${role}`}
        </Text>
      )}
    </InlineStack>
  );
}

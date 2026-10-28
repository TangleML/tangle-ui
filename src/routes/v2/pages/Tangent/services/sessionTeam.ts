import type { TeamResolution, TeamSummary } from "@/services/teams/types";

const teamProjectBrief = (team: TeamSummary) =>
  [
    "Working in a workspace's project:",
    `- This project belongs to the ${team.label} workspace (team id ${team.id}).`,
    "  A run submitted as the workspace is created by it and can use only",
    "  the workspace's secrets. A run submitted as the user can use only the",
    "  user's.",
    "- A turn may act as the workspace only when the person whose message",
    "  started it is in the workspace and grants it. Even then, each call",
    "  chooses: tools go as the user unless asked to act as the workspace",
    "  (asTeam). Never send the team header yourself.",
    "- tangle_root_config_show says whether the current turn may act as the",
    "  workspace. The secrets list and the submit result say which identity a",
    "  call went as.",
    "- Check secrets and submit as the same identity. Act as the workspace",
    "  when the user asks for it, or when the run needs a secret only the",
    "  workspace has.",
    "- If a task needs the workspace and the current turn isn't granted it,",
    "  say so and ask someone in the workspace to send the request. Don't",
    "  retry it as the user unless they ask for that.",
    "- If a pipeline needs a secret neither has, ask the user to add it in the",
    "  project's Secrets window. Never ask for, store or pass on a secret's",
    "  value.",
  ].join("\n");

export function sessionTeamBrief(team: TeamResolution): string | null {
  switch (team.status) {
    case "active":
    case "not-member":
    case "unavailable":
      return teamProjectBrief(team.team);
    default:
      return null;
  }
}

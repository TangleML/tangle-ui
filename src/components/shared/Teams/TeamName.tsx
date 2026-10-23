import { Icon } from "@/components/ui/icon";
import type { TeamSummary } from "@/services/teams/types";

export function TeamName({ team }: { team: TeamSummary }) {
  return (
    <span className="whitespace-nowrap" title={team.id}>
      <Icon
        name="Shapes"
        size="xs"
        className="mr-1 inline-block align-text-bottom"
      />
      {team.label}
    </span>
  );
}

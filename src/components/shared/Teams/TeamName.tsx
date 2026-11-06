import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { TeamSummary } from "@/services/teams/types";

const BOLD_ICON_STROKE_WIDTH = 3;

export function TeamName({
  team,
  bold = false,
}: {
  team: TeamSummary;
  bold?: boolean;
}) {
  return (
    <span
      className={cn("whitespace-nowrap", bold && "font-semibold")}
      title={team.id}
    >
      <Icon
        name="Shapes"
        size="xs"
        strokeWidth={bold ? BOLD_ICON_STROKE_WIDTH : undefined}
        className="mr-0.5 inline-block align-[-0.1em]"
      />
      {team.label}
    </span>
  );
}

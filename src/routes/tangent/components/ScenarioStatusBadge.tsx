import { Badge } from "@/components/ui/badge";
import { SCENARIO_STATUS_LABELS } from "@/routes/tangent/labels";
import type { ScenarioStatus } from "@/routes/tangent/types";

interface ScenarioStatusBadgeProps {
  status: ScenarioStatus;
}

const STATUS_PREFIX: Record<ScenarioStatus, string> = {
  no_scenario: "○",
  scenario_built: "✓",
  scenario_ready: "●",
  tangent_running: "◎",
  results_available: "✓",
};

const STATUS_VARIANT: Record<
  ScenarioStatus,
  "secondary" | "default" | "outline"
> = {
  no_scenario: "outline",
  scenario_built: "secondary",
  scenario_ready: "secondary",
  tangent_running: "default",
  results_available: "default",
};

export function ScenarioStatusBadge({ status }: ScenarioStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} shape="rounded">
      {STATUS_PREFIX[status]} {SCENARIO_STATUS_LABELS[status]}
    </Badge>
  );
}

import type {
  PipelineFilter,
  RunStatus,
  ScenarioStatus,
} from "@/routes/tangent/types";

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  running: "Running",
};

export const SCENARIO_STATUS_LABELS: Record<ScenarioStatus, string> = {
  no_scenario: "No scenario",
  scenario_built: "Scenario built",
  scenario_ready: "Scenario ready",
  tangent_running: "Tangent running",
  results_available: "Results available",
};

export const PIPELINE_FILTER_LABELS: Record<PipelineFilter, string> = {
  all: "All",
  my_pipelines: "My pipelines",
  has_results: "Has results",
};

export const PIPELINE_FILTERS: PipelineFilter[] = [
  "all",
  "my_pipelines",
  "has_results",
];

type ScoreBand = "high" | "medium" | "low";

/** Maps an opportunity score to its color band per the product spec. */
function getScoreBand(score: number): ScoreBand {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

/** Tailwind text color class for a score band (and the unscored case). */
export function getScoreColorClass(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  const band = getScoreBand(score);
  if (band === "high") return "text-emerald-600 dark:text-emerald-400";
  if (band === "medium") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/** Stroke color (currentColor-friendly) for the score ring per band. */
export function getScoreStrokeClass(score: number | null): string {
  if (score === null) return "stroke-muted-foreground/40";
  const band = getScoreBand(score);
  if (band === "high") return "stroke-emerald-500";
  if (band === "medium") return "stroke-amber-500";
  return "stroke-muted-foreground/50";
}

/** Derives the creator handle from an owner email (part before `@`). */
export function getCreatorHandle(ownerEmail?: string): string | undefined {
  if (!ownerEmail) return undefined;
  const [handle] = ownerEmail.split("@");
  return handle || undefined;
}

/**
 * Local domain types for the Tangent Phase 1 prototype.
 *
 * These intentionally live outside `src/api/types.gen.ts`: the real backend
 * `Tangent/*` endpoints currently only cover instances, so for Phase 1 the
 * dashboard and project-detail screens are driven entirely by a mocked API
 * layer that resolves these shapes.
 */

export type RunStatus = "succeeded" | "failed" | "running";

export type ScenarioStatus =
  | "no_scenario"
  | "scenario_built"
  | "scenario_ready"
  | "tangent_running"
  | "results_available";

type IdeaType =
  | "feature_engineering"
  | "hyper_parameter_optimization"
  | "input_data"
  | "model_architecture";

type IdeaImpact = "high" | "medium" | "low";

type IdeaSource = "tangent" | "human";

type IdeaBuildState = "unbuilt" | "building" | "built" | "failed";

export interface ExperimentIdea {
  id: string;
  rank: number;
  title: string;
  type: IdeaType;
  source: IdeaSource;
  impact?: IdeaImpact;
  /** One-sentence evidence (Tangent ideas) or description (human ideas). */
  evidence: string;
  /** Display name of the human author (human ideas only). */
  author?: string;
  buildState: IdeaBuildState;
  /** Display name of whoever built the scenario, when built. */
  builtBy?: string;
  builtAt?: string;
  unverifiedCount?: number;
  upvotes?: number;
  downvotes?: number;
}

interface ResultsCase {
  example: string;
  baseline: string;
  best: string;
  delta: string;
}

interface TangentResults {
  metricDelta: string;
  bestDelta: string;
  bestRunId: string;
  configChanges: string;
  topWinningCases: ResultsCase[];
  topLosingCases: ResultsCase[];
}

export interface TangentPipeline {
  /** Tangle run ID — 20 hex characters beginning with `019`. */
  runId: string;
  name: string;
  /** Owner email; the part before `@` is the displayed creator handle. */
  ownerEmail?: string;
  runStatus: RunStatus;
  lastRunAt: string;
  metricName?: string;
  metricValue?: number;
  baselineValue?: number;
  /** Percentage change vs baseline; positive is an improvement. */
  metricDeltaPct?: number;
  scenarioStatus: ScenarioStatus;
  /** 0-100 opportunity score; `null` means not yet analyzed. */
  opportunityScore: number | null;
  /** Whether Tangent is currently scoring this pipeline. */
  analyzing: boolean;
  /** Two-sentence rationale shown on the card. */
  rationale?: string;
  /** Longer summary shown in the project-detail analysis section. */
  summary?: string;
  oasisUrl?: string;
  /** Whether the signed-in user has built a scenario for this pipeline. */
  builtByCurrentUser: boolean;
  ideas: ExperimentIdea[];
  results?: TangentResults;
}

export interface TeamStats {
  /** Distinct people who built at least one scenario, or `null` while loading. */
  members: number | null;
  /** Total scenarios built across the team, or `null` while loading. */
  scenarios: number | null;
  /** Pipelines that completed optimization and have results, or `null`. */
  withResults: number | null;
}

export type PipelineFilter = "all" | "my_pipelines" | "has_results";

export const TangentQueryKeys = {
  All: () => ["tangent"] as const,
  Stats: () => ["tangent", "stats"] as const,
  Pipelines: () => ["tangent", "pipelines"] as const,
  Pipeline: (runId: string) => ["tangent", "pipeline", runId] as const,
  Research: (instanceId: string, sessionId: string) =>
    ["tangent", "research", instanceId, sessionId] as const,
} as const;

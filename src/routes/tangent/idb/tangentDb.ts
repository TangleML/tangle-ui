import { Dexie, type EntityTable } from "dexie";

export type ScenarioIdeaType =
  | "feature_engineering"
  | "hyperparameter_optimization"
  | "input_data"
  | "model_architecture";

export type ScenarioImpact = "high" | "medium" | "low";

/** Reference back to the Tangle run a scenario was planned against. */
interface ScenarioRunRef {
  runId: string;
  /** Full URL captured at creation time (window.location.href). */
  url: string;
}

export interface ScenarioIdea {
  title: string;
  ideaType: ScenarioIdeaType;
  impact: ScenarioImpact;
  evidence: string;
}

/**
 * Placeholders for the richer ScenarioYaml planning fields
 * (search_space, metrics, budget, ...). Only name/description are
 * populated on creation; the rest are filled in later as the user
 * fleshes out the experiment plan.
 */
interface ScenarioPlan {
  name: string;
  description: string;
  pipeline?: { path: string; baseline_run_id: string };
  metrics?: unknown;
  search_space?: Record<string, unknown>;
  experiment_actions?: Record<string, unknown>;
  research?: unknown;
  budget?: unknown;
  timing?: unknown;
  failure_playbook?: unknown[];
}

/**
 * Reference to the OpenCode agent session created when automated research is
 * started for a scenario. Persisted so the UI can surface a follow link.
 */
interface ScenarioResearch {
  instanceId: string;
  sessionId: string;
  url: string;
  startedAt: number;
}

export interface ScenarioEntry {
  id: string;
  run: ScenarioRunRef;
  score: number;
  rationale: string;
  summary: string;
  /** Only the ideas the user selected when building the scenario. */
  ideas: ScenarioIdea[];
  plan: ScenarioPlan;
  research?: ScenarioResearch;
  createdAt: number;
  updatedAt: number;
}

export const tangentDb = new Dexie("tangle_tangent") as Dexie & {
  scenarios: EntityTable<ScenarioEntry, "id">;
};

tangentDb.version(1).stores({
  scenarios: "id, run.runId, createdAt",
});

export async function saveScenario(entry: ScenarioEntry): Promise<void> {
  await tangentDb.scenarios.put(entry);
}

import {
  MOCK_PIPELINES,
  MOCK_TEAM_STATS,
} from "@/routes/tangent/mocks/mockData";
import type { TangentPipeline, TeamStats } from "@/routes/tangent/types";

/**
 * Mocked Tangent API service for Phase 1.
 *
 * Every function simulates a short network round-trip and resolves data from
 * the in-memory fixtures. When the real `Tangent/*` endpoints land, these
 * functions are the single place to swap in the generated SDK calls.
 */

const SIMULATED_LATENCY_MS = 350;

const delay = <T>(value: T, ms = SIMULATED_LATENCY_MS): Promise<T> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

export const fetchTangentStats = (): Promise<TeamStats> =>
  delay(clone(MOCK_TEAM_STATS));

export const fetchTangentPipelines = (): Promise<TangentPipeline[]> =>
  delay(clone(MOCK_PIPELINES));

export const fetchTangentPipeline = (
  runId: string,
): Promise<TangentPipeline | undefined> =>
  delay(clone(MOCK_PIPELINES.find((pipeline) => pipeline.runId === runId)));

/**
 * Stubbed re-analyze trigger. In Phase 1 this is a no-op that resolves after a
 * simulated delay so the UI can show a queued/refresh affordance.
 */
export const reanalyzeAllPipelines = (): Promise<void> => delay(undefined, 600);

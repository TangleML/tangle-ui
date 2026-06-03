import { useLiveQuery } from "dexie-react-hooks";

import { type ScenarioEntry, tangentDb } from "@/routes/tangent/idb/tangentDb";

/**
 * Reactively reads the saved experiment scenarios for a given run,
 * newest first. Returns an empty array while loading or when no run id
 * is provided.
 */
export function useRunScenarios(runId?: string): {
  scenarios: ScenarioEntry[];
} {
  const scenarios =
    useLiveQuery(async () => {
      if (!runId) return [];
      const rows = await tangentDb.scenarios
        .where("run.runId")
        .equals(runId)
        .sortBy("createdAt");
      return rows.reverse();
    }, [runId]) ?? [];

  return { scenarios };
}

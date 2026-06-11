import { useLiveQuery } from "dexie-react-hooks";

import { type ScenarioEntry, tangentDb } from "@/routes/tangent/idb/tangentDb";

/**
 * Reactively reads saved experiment scenarios grouped by run id, keeping the
 * highest-scoring scenario as the representative for each run. Used to drive
 * the dashboard, which lists every run that has at least one scenario.
 */
export function useScenarioRunIds(): {
  runIds: Set<string>;
  representativeByRun: Map<string, ScenarioEntry>;
  isLoading: boolean;
} {
  const representativeByRun = useLiveQuery(async () => {
    const rows = await tangentDb.scenarios.toArray();
    const byRun = new Map<string, ScenarioEntry>();
    for (const row of rows) {
      const current = byRun.get(row.run.runId);
      if (!current || row.score > current.score) {
        byRun.set(row.run.runId, row);
      }
    }
    return byRun;
  }, []);

  return {
    runIds: new Set(representativeByRun?.keys() ?? []),
    representativeByRun:
      representativeByRun ?? new Map<string, ScenarioEntry>(),
    isLoading: representativeByRun === undefined,
  };
}

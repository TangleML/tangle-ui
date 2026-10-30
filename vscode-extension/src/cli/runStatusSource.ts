import type { TangleRestClient } from "../tangleRestClient.ts";
import { parseGraphState, statusTotalsFor } from "./graphState.ts";
import type { TangleDeployCli } from "./tangleDeployCli.ts";

export type RunStatusFor = (
  runId: string,
) => Promise<Record<string, number> | null>;

/**
 * Per-status task counts for a run. When the CLI is present it is the source of
 * truth (`pipeline-run graph-state`), so the extension does not duplicate the
 * backend's status endpoint; without it, or on any CLI error, the REST client's
 * run stats stand in so the Runs view keeps working.
 */
export function createRunStatusSource(
  cli: TangleDeployCli,
  createClient: () => Promise<TangleRestClient>,
): RunStatusFor {
  return async (runId) => {
    if (cli.availableNow) {
      try {
        const results = await cli.json(
          ["pipeline-run", "graph-state", runId, "--log-type", "none"],
          parseGraphState,
        );
        return statusTotalsFor(results, runId);
      } catch {
        // Fall through to REST for this run.
      }
    }
    return (await createClient()).getRunStats(runId);
  };
}

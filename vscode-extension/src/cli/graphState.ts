import {
  array,
  type infer as Infer,
  nullish,
  number,
  object,
  record,
  string,
} from "zod/mini";

const graphStateResult = object({
  run_id: string(),
  root_execution_id: nullish(string()),
  status_totals: nullish(record(string(), number())),
  failed_execution_ids: nullish(array(string())),
  error: nullish(string()),
});

const graphStateResponse = object({
  results: array(graphStateResult),
});

export type GraphStateResult = Infer<typeof graphStateResult>;

export function parseGraphState(data: unknown): GraphStateResult[] {
  return graphStateResponse.parse(data).results;
}

/** Per-status task counts for one run, or `null` when the CLI reported an error. */
export function statusTotalsFor(
  results: GraphStateResult[],
  runId: string,
): Record<string, number> | null {
  const match = results.find(
    (result) => result.run_id === runId || result.root_execution_id === runId,
  );
  if (!match || match.error) return null;
  return match.status_totals ?? {};
}

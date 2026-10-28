import { normalizePipelineId } from "@/services/pipelineId";
import { remotePipelineFiltersToQuery } from "@/services/remotePipelinesService";

const CANONICAL_PIPELINE_ID =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;

/** The backend matches IDs exactly, so only a complete ID is searched as one. */
export function pipelinePickerQuery(
  search: string,
  onlyMine: boolean,
): string | undefined {
  const term = search.trim();
  const id = normalizePipelineId(term);
  const searchesById = CANONICAL_PIPELINE_ID.test(id);

  return remotePipelineFiltersToQuery({
    name: searchesById ? undefined : term,
    id: searchesById ? id : undefined,
    user: onlyMine ? "me" : undefined,
  });
}

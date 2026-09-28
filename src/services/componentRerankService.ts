import { rerankComponentsWithJev } from "@/services/jevComponentRerankService";
import {
  type RerankCandidate,
  rerankComponentsByNaturalLanguage,
} from "@/services/naturalLanguageComponentSearchService";
import type { ComponentRerankConfig } from "@/types/aiProvider";

export function rerankComponents(
  query: string,
  candidates: RerankCandidate[],
  options: ComponentRerankConfig & { signal?: AbortSignal },
  settings: { scoreAllCandidates?: boolean } = {},
) {
  return options.provider === "jev"
    ? rerankComponentsWithJev(query, candidates, options)
    : rerankComponentsByNaturalLanguage(query, candidates, options, settings);
}

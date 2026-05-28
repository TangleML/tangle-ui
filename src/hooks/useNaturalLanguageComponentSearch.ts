import { useMutation } from "@tanstack/react-query";

import { useComponentSearchSettings } from "@/hooks/useComponentSearchSettings";
import {
  type ComponentDescriptionResult,
  generateComponentAiDescription,
  type RerankCandidate,
  rerankComponentsByNaturalLanguage,
  type RerankResult,
} from "@/services/naturalLanguageComponentSearchService";
import type { ComponentReference } from "@/utils/componentSpec";

interface RerankVariables {
  query: string;
  candidates: RerankCandidate[];
}

interface DescriptionVariables {
  reference: ComponentReference;
}

/**
 * Trigger an LLM rerank of pre-filtered candidates. Modeled as a mutation
 * rather than a query because rerank is **explicitly initiated** by the user
 * ("Smart Search" button), not automatic on every keystroke — that would
 * burn tokens and add latency to the typeahead experience.
 *
 * The lexical index (see `componentSearchIndex.ts`) is what powers live
 * search. Rerank is the optional, opt-in step when judgment matters more
 * than literal matching.
 */
export function useNaturalLanguageComponentRerank() {
  const { config, isConfigured } = useComponentSearchSettings();

  const mutation = useMutation<RerankResult, Error, RerankVariables>({
    mutationFn: ({ query, candidates }) =>
      rerankComponentsByNaturalLanguage(query, candidates, {
        model: config.model,
        apiBase: config.apiBase,
        apiKey: config.apiKey,
      }),
  });

  return { ...mutation, isConfigured };
}

export function useComponentAiDescription() {
  const { config, isConfigured } = useComponentSearchSettings();

  const mutation = useMutation<
    ComponentDescriptionResult,
    Error,
    DescriptionVariables
  >({
    mutationFn: ({ reference }) =>
      generateComponentAiDescription(reference, {
        model: config.model,
        apiBase: config.apiBase,
        apiKey: config.apiKey,
      }),
  });

  return { ...mutation, isConfigured };
}

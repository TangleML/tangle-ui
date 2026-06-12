import { useMutation, useQuery } from "@tanstack/react-query";

import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
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
  /**
   * When true, ask the model to score every candidate (not just the strongest)
   * so every displayed result can show a relevance percentage. Costs more
   * tokens; callers opt in per surface.
   */
  scoreAllCandidates?: boolean;
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
  const { config, isConfigured } = useAiProviderSettings();

  const mutation = useMutation<RerankResult, Error, RerankVariables>({
    mutationFn: ({ query, candidates, scoreAllCandidates }) =>
      rerankComponentsByNaturalLanguage(
        query,
        candidates,
        {
          model: config.model,
          apiBase: config.apiBase,
          apiKey: config.apiKey,
        },
        { scoreAllCandidates },
      ),
  });

  return { ...mutation, isConfigured };
}

/**
 * Generate an AI description for a single component reference, keyed by
 * digest so each component gets its own cached result, loading state, and
 * error.
 *
 * This is a **query** (not a mutation) so React Query owns:
 *   - Per-digest cache: rapidly clicking between components doesn't re-fire
 *     the call if we already have the answer, and switching back to a
 *     previously-described component shows its description instantly.
 *   - Per-digest error/pending: errors on one component can't bleed into the
 *     loading or error UI of another.
 *   - AbortSignal: switching to a different component (which re-keys the
 *     query) aborts the in-flight billed call instead of leaving it running.
 *
 * `enabled` lets callers opt into auto-generation (e.g. when the
 * `component-search-v2-ai-descriptions` flag is on); when disabled, the
 * description is generated only when the caller invokes `refetch()`.
 */
export function useComponentAiDescription({
  reference,
  enabled,
}: {
  reference: ComponentReference | undefined;
  enabled: boolean;
}) {
  const { config, isConfigured } = useAiProviderSettings();
  const digest = reference?.digest;
  const hasSpec = Boolean(reference?.spec);

  // Key includes apiBase + model so changing provider invalidates cached
  // descriptions (a different model would have written a different answer).
  const query = useQuery<ComponentDescriptionResult, Error>({
    queryKey: ["componentAiDescription", digest, config.apiBase, config.model],
    queryFn: async ({ signal }) => {
      // queryFn is only called when `enabled` is true (guarded below),
      // which itself requires digest + hasSpec, so reference is defined here.
      if (!reference) {
        throw new Error("Component reference is required");
      }
      return generateComponentAiDescription(reference, {
        model: config.model,
        apiBase: config.apiBase,
        apiKey: config.apiKey,
        signal,
      });
    },
    // Auto-fetch only when the caller opted in AND we have everything we
    // need; the manual "Generate" button calls refetch() directly.
    enabled: enabled && isConfigured && Boolean(digest) && hasSpec,
    // Descriptions are deterministic given (digest, model). Never go stale
    // on their own — re-key by changing the queryKey above when needed.
    staleTime: Infinity,
    // Billed calls — don't auto-retry on transient failures. The user can
    // hit the "Try again" button in the panel if they want.
    retry: false,
  });

  return {
    description: query.data?.description,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => query.refetch(),
    isConfigured,
  };
}

import { useQuery } from "@tanstack/react-query";

import { getAiModelOptions } from "@/config/aiModels";
import { fetchCompatibleAiModelIds } from "@/services/aiModelService";
import type { AiProviderConfig } from "@/types/aiProvider";

export function useAvailableAiModels(config: AiProviderConfig, open: boolean) {
  const configuredOptions = getAiModelOptions();
  const candidates = configuredOptions.some(
    (model) => model.id === config.model,
  )
    ? configuredOptions
    : [{ id: config.model }, ...configuredOptions];
  const query = useQuery({
    queryKey: ["ai-models", config.apiBase, config.credentials, config.apiKey],
    queryFn: ({ signal }) => fetchCompatibleAiModelIds(config, signal),
    enabled: open && !!config.apiBase,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    options: config.apiBase
      ? candidates.filter((model) => query.data?.includes(model.id))
      : candidates,
    isLoading: !!config.apiBase && query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}

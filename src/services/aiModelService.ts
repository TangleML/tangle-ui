import type { AiProviderConfig } from "@/types/aiProvider";
import { isRecord } from "@/utils/typeGuards";

interface ResponsesModel {
  id: string;
  requestModel: string;
}

function supportsResponses(model: Record<string, unknown>): boolean {
  // Standard model lists omit endpoints; proxies can explicitly restrict them.
  return (
    !Array.isArray(model.endpoints) ||
    model.endpoints.some(
      (endpoint: unknown) =>
        isRecord(endpoint) &&
        (endpoint.api === "openai-responses" ||
          (typeof endpoint.path === "string" &&
            endpoint.path.replace(/\/+$/, "").endsWith("/responses"))),
    )
  );
}

function readResponsesModel(value: unknown): ResponsesModel | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const id = value.id.trim();
  if (!id || !supportsResponses(value)) return null;
  const callableId =
    typeof value.callable_id === "string" && value.callable_id.trim()
      ? value.callable_id.trim()
      : id;
  const providers = Array.isArray(value.providers)
    ? value.providers.filter(isRecord)
    : [];
  const defaultProvider = providers.find(
    (provider) => provider.route === callableId,
  );

  if (
    !defaultProvider ||
    ((defaultProvider.api_spec === undefined ||
      defaultProvider.api_spec === "openai") &&
      supportsResponses(defaultProvider))
  ) {
    return { id, requestModel: callableId };
  }

  // OpenAI format alone can mean Chat Completions; alternatives must explicitly support Responses.
  const compatibleProvider = providers.find(
    (provider) =>
      provider.api_spec === "openai" &&
      typeof provider.route === "string" &&
      provider.route.trim() &&
      Array.isArray(provider.endpoints) &&
      supportsResponses(provider),
  );
  return compatibleProvider && typeof compatibleProvider.route === "string"
    ? { id, requestModel: compatibleProvider.route.trim() }
    : null;
}

async function fetchResponsesModels(
  config: AiProviderConfig,
  signal?: AbortSignal,
): Promise<ResponsesModel[]> {
  const base = config.apiBase.trim().replace(/\/+$/, "");
  const apiKey = config.apiKey.trim();
  const response = await fetch(`${base}/models`, {
    signal,
    credentials: config.credentials,
    headers: {
      accept: "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Could not load available models (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("The provider returned an invalid model list.");
  }

  return payload.data.map(readResponsesModel).filter((model) => model !== null);
}

export async function fetchCompatibleAiModelIds(
  config: AiProviderConfig,
  signal?: AbortSignal,
): Promise<string[]> {
  const models = await fetchResponsesModels(config, signal);
  return [
    ...new Set(models.flatMap((model) => [model.id, model.requestModel])),
  ];
}

export async function resolveAiResponsesModel(
  config: AiProviderConfig,
  signal?: AbortSignal,
): Promise<string> {
  const id = config.model.trim();
  if (!id) return "";
  const models = await fetchResponsesModels(config, signal);
  const model = models.find(
    (candidate) => candidate.id === id || candidate.requestModel === id,
  );
  if (!model) {
    throw new Error(
      "The selected model is unavailable through this provider’s Responses API. Choose another model.",
    );
  }
  return model.requestModel;
}

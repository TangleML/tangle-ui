import { getAiModelOptions, isAiReasoningEffort } from "@/config/aiConfig";
import { isRecord } from "@/utils/typeGuards";

/** Optional, deployment-selected endpoint. Standalone installs do not call it. */
export function getModelCatalogUrl(): string | undefined {
  return typeof window !== "undefined"
    ? window.__TANGLE_AI_MODELS__?.catalogUrl
    : undefined;
}

export async function loadModelCatalog(signal?: AbortSignal) {
  const url = getModelCatalogUrl();
  if (!url) return null;
  const response = await fetch(url, { credentials: "include", signal });
  if (!response.ok) throw new Error("Unable to load deployment model catalog");
  const value: unknown = await response.json();
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.models) ||
    !value.models.length ||
    !isRecord(value.defaults) ||
    typeof value.defaults.browser !== "string"
  )
    throw new Error("Invalid model catalog");
  const browserModels = value.models.filter(
    (model) => !isRecord(model) || model.browserAvailable !== false,
  );
  for (const model of browserModels) {
    if (
      !isRecord(model) ||
      typeof model.id !== "string" ||
      !model.id.trim() ||
      typeof model.label !== "string" ||
      typeof model.tangentModelId !== "string" ||
      !["openai-responses", "anthropic-messages"].includes(String(model.api)) ||
      !Array.isArray(model.reasoningEfforts) ||
      !model.reasoningEfforts.every(isAiReasoningEffort) ||
      !isRecord(model.thinkingLevelMap)
    )
      throw new Error("Invalid catalog model");
  }
  const models = browserModels as NonNullable<
    Window["__TANGLE_AI_MODELS__"]
  >["models"];
  const defaultModel = value.defaults.browser;
  if (
    !models?.some((m) => m.id === defaultModel) ||
    new Set(models.map((m) => m.id)).size !== models.length
  )
    throw new Error("Invalid catalog default");
  const replacements = isRecord(value.replacements)
    ? (value.replacements as Record<string, string>)
    : {};
  window.__TANGLE_AI_MODELS__ = {
    catalogUrl: url,
    models,
    defaultModel,
    replacements,
  };
  window.dispatchEvent(new Event("tangle:model-catalog"));
  return getAiModelOptions();
}

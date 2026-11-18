import {
  getAiModelOptions,
  isAiModelApi,
  isAiReasoningEffort,
  isThinkingLevelMap,
} from "@/config/aiConfig";
import type { AiModelOption } from "@/types/aiProvider";
import { isRecord, isStringRecord } from "@/utils/typeGuards";

export const MODEL_CATALOG_EVENT = "tangle:model-catalog";

type CatalogModel = AiModelOption &
  Required<Pick<AiModelOption, "label" | "tangentModelId" | "api">>;

/** Optional, deployment-selected endpoint. Standalone installs do not call it. */
export function getModelCatalogUrl(): string | undefined {
  return typeof window !== "undefined"
    ? window.__TANGLE_AI_MODELS__?.catalogUrl
    : undefined;
}

function isAgentOnly(model: unknown): boolean {
  return isRecord(model) && model.browserAvailable === false;
}

function isCatalogModel(value: unknown): value is CatalogModel {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.label === "string" &&
    typeof value.tangentModelId === "string" &&
    isAiModelApi(value.api) &&
    Array.isArray(value.reasoningEfforts) &&
    value.reasoningEfforts.every(isAiReasoningEffort) &&
    isThinkingLevelMap(value.thinkingLevelMap)
  );
}

export async function loadModelCatalog() {
  const url = getModelCatalogUrl();
  if (!url) return null;
  const response = await fetch(url, { credentials: "include" });
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
  const models = value.models.filter((model) => !isAgentOnly(model));
  if (!models.every(isCatalogModel)) throw new Error("Invalid catalog model");
  const defaultModel = value.defaults.browser;
  if (
    !models.some((m) => m.id === defaultModel) ||
    new Set(models.map((m) => m.id)).size !== models.length
  )
    throw new Error("Invalid catalog default");
  if (value.replacements !== undefined && !isStringRecord(value.replacements))
    throw new Error("Invalid catalog replacements");
  window.__TANGLE_AI_MODELS__ = {
    catalogUrl: url,
    models,
    defaultModel,
    replacements: value.replacements ?? {},
  };
  window.dispatchEvent(new Event(MODEL_CATALOG_EVENT));
  return getAiModelOptions();
}

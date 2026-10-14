import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAiModelLabel,
  getAiModelOptions,
  getAiModelReasoningLevels,
  getDefaultAiModelId,
  getEffectiveReasoningEffort,
  supportsAiEmbeddings,
} from "./aiConfig";

describe("aiConfig", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.__TANGLE_AI_MODELS__;
  });

  it("suggests unique models and includes the default", () => {
    const ids = getAiModelOptions().map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(getDefaultAiModelId());
  });

  it("allows host pages to replace model suggestions and the suggested default", () => {
    window.__TANGLE_AI_MODELS__ = {
      defaultModel: "proxy-frontier",
      models: [
        {
          id: "proxy-frontier",
          label: "Proxy frontier",
          description: "Default proxy model",
        },
        { id: "proxy-fast" },
      ],
    };

    expect(getDefaultAiModelId()).toBe("proxy-frontier");
    expect(getAiModelOptions()).toEqual([
      {
        id: "proxy-frontier",
        label: "Proxy frontier",
        description: "Default proxy model",
      },
      { id: "proxy-fast" },
    ]);
  });

  it.each<[string, boolean]>([
    ["", false],
    ["   ", false],
    ["https://api.anthropic.com/v1", false],
    [" https://api.anthropic.com:443/v1/ ", false],
    ["https://gateway.example.com/v1", true],
    ["https://backend.example.com/api/experimental/ai/v1", true],
  ])("checks embedding support for %s", (apiBase, expected) => {
    expect(supportsAiEmbeddings(apiBase)).toBe(expected);
  });

  it("uses the nearest supported thinking level without inventing capabilities", () => {
    expect(getEffectiveReasoningEffort("gpt-6-astra", "none")).toBe("low");
    expect(getEffectiveReasoningEffort("gpt-6-sol", "none")).toBe("none");
    expect(getEffectiveReasoningEffort("gpt-6-luna", "max")).toBe("max");
    expect(getEffectiveReasoningEffort("custom-model", "high")).toBeUndefined();
    expect(
      getEffectiveReasoningEffort("claude-custom", "high"),
    ).toBeUndefined();
  });

  it.each([
    "claude-fable-5-1",
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-haiku-5-5",
  ])("supports Low through Max thinking for %s", (model) => {
    expect(
      getAiModelReasoningLevels(model).map((level) => level.value),
    ).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(getEffectiveReasoningEffort(model)).toBe("high");
    expect(getEffectiveReasoningEffort(model, "none")).toBe("low");
    expect(getEffectiveReasoningEffort(model, "max")).toBe("max");
  });

  it("leaves model capabilities to the provider default", () => {
    expect(getAiModelLabel("")).toBe("Provider default");
    expect(getEffectiveReasoningEffort("", "max")).toBeUndefined();
  });

  it("resolves thinking levels supplied by the host", () => {
    window.__TANGLE_AI_MODELS__ = {
      models: [{ id: "custom", reasoningEfforts: ["low", "high"] }],
    };
    expect(getEffectiveReasoningEffort("custom", "max")).toBe("high");
    expect(getEffectiveReasoningEffort("custom", "medium")).toBe("low");
  });

  it("resolves a transmitted host catalog without access to the host window", () => {
    window.__TANGLE_AI_MODELS__ = {
      models: [{ id: "custom", reasoningEfforts: ["low", "high"] }],
    };
    const models = getAiModelOptions();
    vi.stubGlobal("window", undefined);

    expect(getEffectiveReasoningEffort("custom", "max", models)).toBe("high");
    expect(
      getEffectiveReasoningEffort("gpt-6-sol", "max", models),
    ).toBeUndefined();
    expect(getEffectiveReasoningEffort(" ", "max", models)).toBeUndefined();
  });
});

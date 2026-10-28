import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiModelCapabilities } from "@/types/aiProvider";

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

  it("defaults to the first model in the catalog", () => {
    const ids = getAiModelOptions().map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getDefaultAiModelId()).toBe(ids[0]);
    expect(getDefaultAiModelId()).toBe("gpt-6-astra");
  });

  it("uses the first valid model supplied by the host as the default", () => {
    window.__TANGLE_AI_MODELS__ = {
      models: [
        { id: "   " },
        {
          id: " proxy-frontier ",
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

  it("falls back to the built-in catalog when the host supplies no valid models", () => {
    window.__TANGLE_AI_MODELS__ = { models: [{ id: " " }] };

    expect(getDefaultAiModelId()).toBe("gpt-6-astra");
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
    expect(getEffectiveReasoningEffort("gpt-6.1-sol", "none")).toBe("low");
    expect(getEffectiveReasoningEffort("gpt-6.1-terra", "none")).toBe("none");
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

  it("labels an empty selection with the first catalog model", () => {
    expect(getAiModelLabel(" ")).toBe("GPT-6 Astra");
  });

  it("does not infer reasoning capabilities for a blank model ID", () => {
    expect(getEffectiveReasoningEffort("", "max")).toBeUndefined();
    expect(getEffectiveReasoningEffort(" ", "max")).toBeUndefined();
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
      getEffectiveReasoningEffort("gpt-6.1-sol", "max", models),
    ).toBeUndefined();
    expect(getEffectiveReasoningEffort(" ", "max", models)).toBeUndefined();
  });

  it("intersects consumer and model capabilities before choosing the nearest level", () => {
    const models: AiModelCapabilities[] = [
      { id: "custom", reasoningEfforts: ["low", "high", "max"] },
    ];
    const supported = ["none", "high", "xhigh"] as const;

    expect(getAiModelReasoningLevels("custom", models, supported)).toEqual([
      { value: "high", label: "High" },
    ]);
    expect(
      getEffectiveReasoningEffort("custom", "max", models, supported),
    ).toBe("high");
    expect(
      getEffectiveReasoningEffort("custom", "max", models, []),
    ).toBeUndefined();
    expect(
      getEffectiveReasoningEffort("unknown", "max", models, supported),
    ).toBeUndefined();
  });
});

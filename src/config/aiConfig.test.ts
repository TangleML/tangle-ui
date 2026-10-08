import { afterEach, describe, expect, it } from "vitest";

import {
  getAiModelLabel,
  getAiModelOptions,
  getDefaultAiModelId,
  getEffectiveReasoningEffort,
} from "./aiConfig";

describe("aiConfig", () => {
  afterEach(() => {
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

  it("uses the nearest supported thinking level without inventing capabilities", () => {
    expect(getEffectiveReasoningEffort("gpt-6-astra", "none")).toBe("low");
    expect(getEffectiveReasoningEffort("gpt-6-sol", "none")).toBe("none");
    expect(getEffectiveReasoningEffort("gpt-6-luna", "max")).toBe("max");
    expect(getEffectiveReasoningEffort("custom-model", "high")).toBeUndefined();
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
});

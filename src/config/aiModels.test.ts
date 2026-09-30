import { afterEach, describe, expect, it } from "vitest";

import {
  getAiModelOptions,
  getDefaultAiModelId,
  getEffectiveReasoningEffort,
} from "./aiModels";

describe("aiModels", () => {
  afterEach(() => {
    delete window.__TANGLE_AI_MODELS__;
  });

  it("uses built-in model suggestions by default", () => {
    expect(getAiModelOptions().map((option) => option.id)).toEqual([
      "gpt-6-astra",
      "gpt-6-sol",
      "gpt-6-luna",
    ]);
    expect(getDefaultAiModelId()).toBe("gpt-6-sol");
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

  it("resolves thinking levels supplied by the host", () => {
    window.__TANGLE_AI_MODELS__ = {
      models: [
        { id: "custom-reasoning-model", reasoningEfforts: ["low", "high"] },
      ],
    };
    expect(getEffectiveReasoningEffort("custom-reasoning-model", "max")).toBe(
      "high",
    );
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  getAiModelLabel,
  getAiModelOptions,
  getDefaultAiModelId,
} from "./aiModels";

describe("aiModels", () => {
  afterEach(() => {
    delete window.__TANGLE_AI_MODELS__;
  });

  it("uses built-in model suggestions by default", () => {
    expect(getAiModelOptions()).toEqual([
      {
        id: "gpt-6-sol",
        label: "GPT-6 Sol",
        description: "For everyday work and coding.",
      },
      {
        id: "gpt-6-astra",
        label: "GPT-6 Astra",
        description: "For complex, multi-step tasks.",
      },
    ]);
    expect(getDefaultAiModelId()).toBe("gpt-6-sol");
  });

  it("keeps friendly labels for saved models outside the current suggestions", () => {
    expect(getAiModelLabel("gpt-5.6-sol")).toBe("GPT-5.6 Sol");
    expect(getAiModelLabel("gpt-4o-mini")).toBe("GPT-4o mini");
    expect(getAiModelLabel("custom-model")).toBe("custom-model");
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
});

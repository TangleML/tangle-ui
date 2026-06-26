import { afterEach, describe, expect, it } from "vitest";

import { getAiModelOptions, getDefaultAiModelId } from "./aiModels";

describe("aiModels", () => {
  afterEach(() => {
    delete window.__TANGLE_AI_MODELS__;
  });

  it("uses built-in model suggestions by default", () => {
    expect(getAiModelOptions().map((option) => option.id)).toContain("gpt-5.5");
    expect(getDefaultAiModelId()).toBe("gpt-5.5");
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

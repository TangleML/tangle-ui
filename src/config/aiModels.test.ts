import { describe, expect, it } from "vitest";

import {
  AI_REASONING_EFFORTS,
  DEFAULT_AI_REASONING_EFFORT,
  getAiModelLabel,
  getAiModelOptions,
  getAiReasoningConfig,
  getDefaultAiModelId,
  isAiReasoningEffort,
} from "./aiModels";

describe("aiModels", () => {
  it("offers only the GPT-6 family with Sol and High as defaults", () => {
    expect(getAiModelOptions()).toEqual([
      { id: "gpt-6-astra", label: "GPT-6 Astra" },
      { id: "gpt-6-sol", label: "GPT-6 Sol" },
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
    ]);
    expect(getDefaultAiModelId()).toBe("gpt-6-sol");
    expect(DEFAULT_AI_REASONING_EFFORT).toBe("high");
    expect(AI_REASONING_EFFORTS.map((option) => option.label)).toEqual([
      "Low",
      "Medium",
      "High",
      "Extra High",
      "Max",
    ]);
  });

  it("keeps friendly labels for saved or manual models outside the picker", () => {
    expect(getAiModelLabel("gpt-5.6-sol")).toBe("GPT-5.6 Sol");
    expect(getAiModelLabel("gpt-4o-mini")).toBe("GPT-4o mini");
    expect(getAiModelLabel("custom-model")).toBe("custom-model");
    expect(getAiModelLabel("")).toBe("Provider default");
  });

  it.each(["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"])(
    "supports every slider effort for %s",
    (model) => {
      for (const { value } of AI_REASONING_EFFORTS) {
        expect(getAiReasoningConfig(model, value)).toEqual({ effort: value });
      }
      expect(getAiReasoningConfig(model)).toEqual({ effort: "high" });
    },
  );

  it.each(["", "custom-model", "gpt-4o-mini", "gpt-5.5"])(
    "omits GPT-6 thinking parameters for %s",
    (model) => expect(getAiReasoningConfig(model, "max")).toBeUndefined(),
  );

  it("validates stored effort instead of sending unsupported values", () => {
    expect(isAiReasoningEffort("max")).toBe(true);
    expect(isAiReasoningEffort("ultra")).toBe(false);
    expect(isAiReasoningEffort(null)).toBe(false);
  });
});

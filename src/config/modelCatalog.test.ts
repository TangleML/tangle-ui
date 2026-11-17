import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_CONFIG,
  getAiModelOptions,
  getAiProviderConfig,
  getDefaultAiModelId,
} from "@/config/aiConfig";
import {
  getStartingSessionModel,
  getStartingSessionThinkingDepth,
} from "@/services/projects/startingSession";

import { loadModelCatalog } from "./modelCatalog";

const model = {
  id: "example-model",
  label: "Example",
  api: "anthropic-messages",
  tangentModelId: "example/example-model",
  reasoningEfforts: ["low", "high", "max"],
  thinkingLevelMap: {
    off: null,
    minimal: null,
    low: "low",
    medium: null,
    high: "high",
    xhigh: "max",
    max: "max",
  },
};
const fixture = {
  schemaVersion: 1,
  defaults: { browser: model.id },
  replacements: { "old-example": model.id },
  models: [model],
};
describe("deployment model catalog", () => {
  afterEach(() => {
    delete window.__TANGLE_AI_MODELS__;
    vi.unstubAllGlobals();
  });
  it("does not fetch a catalog for standalone installations", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await loadModelCatalog()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("loads authenticated choices and explicit model/thinking handoff", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models" };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(fixture)));
    vi.stubGlobal("fetch", fetch);
    await loadModelCatalog();
    expect(fetch).toHaveBeenCalledWith(
      "/api/example-models",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(getDefaultAiModelId()).toBe(model.id);
    expect(getAiModelOptions()).toHaveLength(1);
    expect(getAiProviderConfig(model.id)).toBe(AI_CONFIG.providers.anthropic);
    expect(getStartingSessionModel({ model: model.id })).toBe(
      model.tangentModelId,
    );
    expect(
      getStartingSessionThinkingDepth({
        model: model.id,
        reasoningEffortPreference: "max",
      }),
    ).toBe("xhigh");
  });
  it("does not offer agent-only Chat Completions models for browser execution", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models" };
    const agentOnly = {
      ...model,
      id: "agent-only",
      api: "openai-completions",
      browserAvailable: false,
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...fixture, models: [model, agentOnly] }),
          ),
        ),
    );
    await loadModelCatalog();
    expect(getAiModelOptions().map((m) => m.id)).toEqual([model.id]);
  });

  it("rejects failed and invalid catalogs without installing a partial list", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );
    await expect(loadModelCatalog()).rejects.toThrow();
    expect(window.__TANGLE_AI_MODELS__.models).toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...fixture, schemaVersion: 2 })),
        ),
    );
    await expect(loadModelCatalog()).rejects.toThrow();
    expect(window.__TANGLE_AI_MODELS__.models).toBeUndefined();
  });
});

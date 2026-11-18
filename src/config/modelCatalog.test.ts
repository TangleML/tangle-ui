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

import { ensureModelCatalog, getModelCatalogStatus } from "./modelCatalog";

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
    expect(await ensureModelCatalog()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("loads authenticated choices and explicit model/thinking handoff", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models/handoff" };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(fixture)));
    vi.stubGlobal("fetch", fetch);
    await ensureModelCatalog();
    expect(fetch).toHaveBeenCalledWith(
      "/api/example-models/handoff",
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
  it("shares one request between every consumer on the page", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models/shared" };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(fixture)));
    vi.stubGlobal("fetch", fetch);
    expect(getModelCatalogStatus()).toBe("loading");
    await Promise.all([ensureModelCatalog(), ensureModelCatalog()]);
    await ensureModelCatalog();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getModelCatalogStatus()).toBe("ready");
  });

  it("does not offer agent-only Chat Completions models for browser execution", async () => {
    window.__TANGLE_AI_MODELS__ = {
      catalogUrl: "/api/example-models/agent-only",
    };
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
    await ensureModelCatalog();
    expect(getAiModelOptions().map((m) => m.id)).toEqual([model.id]);
  });

  it("hands off the nearest mapped level when the preferred effort has no Pi level", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models/gappy" };
    const gappy = {
      ...model,
      reasoningEfforts: ["low", "medium", "high"],
      thinkingLevelMap: { ...model.thinkingLevelMap, xhigh: null, max: null },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...fixture,
            defaults: { browser: gappy.id },
            models: [gappy],
          }),
        ),
      ),
    );
    await ensureModelCatalog();
    expect(
      getStartingSessionThinkingDepth({
        model: gappy.id,
        reasoningEffortPreference: "medium",
      }),
    ).toBe("low");
  });

  it("rejects failed and invalid catalogs without installing a partial list", async () => {
    window.__TANGLE_AI_MODELS__ = { catalogUrl: "/api/example-models/invalid" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );
    await expect(ensureModelCatalog()).rejects.toThrow();
    expect(window.__TANGLE_AI_MODELS__.models).toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...fixture, schemaVersion: 2 })),
        ),
    );
    await expect(ensureModelCatalog()).rejects.toThrow();
    expect(window.__TANGLE_AI_MODELS__.models).toBeUndefined();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ ...fixture, replacements: { old: 42 } }),
          ),
        ),
    );
    await expect(ensureModelCatalog()).rejects.toThrow();
    expect(window.__TANGLE_AI_MODELS__.models).toBeUndefined();
  });
});

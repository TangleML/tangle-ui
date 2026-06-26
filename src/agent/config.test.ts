import { beforeEach, describe, expect, it, vi } from "vitest";

const setDefaultOpenAIClient = vi.fn();
const setOpenAIAPI = vi.fn();
const setTracingDisabled = vi.fn();
const openaiCtor = vi.fn();

vi.mock("@openai/agents", () => ({
  setDefaultOpenAIClient: (...args: unknown[]) =>
    setDefaultOpenAIClient(...args),
  setOpenAIAPI: (...args: unknown[]) => setOpenAIAPI(...args),
  setTracingDisabled: (...args: unknown[]) => setTracingDisabled(...args),
}));

vi.mock("openai", () => {
  class FakeOpenAI {
    constructor(options: unknown) {
      openaiCtor(options);
    }
  }
  return { default: FakeOpenAI };
});

const { getAgentModelConfig, ProxyClient } = await import("./config");

const BASE_CONFIG = {
  apiBase: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "",
};

describe("getAgentModelConfig", () => {
  it("omits the model when the configured model is blank", () => {
    expect(getAgentModelConfig(BASE_CONFIG)).toEqual({
      modelSettings: {
        providerData: {
          include: ["reasoning.encrypted_content"],
        },
      },
    });
  });

  it("uses the configured model with Responses reasoning continuity", () => {
    expect(getAgentModelConfig({ ...BASE_CONFIG, model: "gpt-5.5" })).toEqual({
      model: "gpt-5.5",
      modelSettings: {
        providerData: {
          include: ["reasoning.encrypted_content"],
        },
      },
    });
  });
});

describe("ProxyClient", () => {
  beforeEach(() => {
    openaiCtor.mockClear();
    setDefaultOpenAIClient.mockClear();
    setOpenAIAPI.mockClear();
    setTracingDisabled.mockClear();
  });

  it("uses the Responses API for Sidekick", () => {
    const client = new ProxyClient();
    client.ensureConfigured({ ...BASE_CONFIG, model: "gpt-5.5" });

    expect(setOpenAIAPI).toHaveBeenLastCalledWith("responses");
  });

  it("reuses the SDK client when proxy settings are unchanged", () => {
    const client = new ProxyClient();
    client.ensureConfigured({ ...BASE_CONFIG, model: "gpt-4o-mini" });
    client.ensureConfigured({ ...BASE_CONFIG, model: "gpt-5.5" });

    expect(openaiCtor).toHaveBeenCalledTimes(1);
    expect(setOpenAIAPI).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAiModelOptions } from "@/config/aiModels";
import { AI_USE_OWN_KEY_STORAGE_KEY } from "@/hooks/useAiProviderSettings";
import type { AiProviderConfig } from "@/types/aiProvider";

import { AiModelQuickSelect } from "./AiModelQuickSelect";

const STORAGE_KEY = "tangle.aiProvider.config";
const FLAGS_STORAGE_KEY = "betaFlags";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

vi.mock("@/hooks/useAvailableAiModels", () => ({
  useAvailableAiModels: (config: AiProviderConfig) => ({
    options: [{ id: config.model }, ...getAiModelOptions()],
    isLoading: false,
    isError: false,
  }),
}));

function enableFlags(flags: Record<string, boolean>) {
  window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(flags));
}

describe("AiModelQuickSelect", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  afterEach(() => {
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  it("does not render until AI provider settings are configured", () => {
    enableFlags({ "ai-assistant": true });

    render(<AiModelQuickSelect />);

    expect(
      screen.queryByRole("button", { name: /^AI model and thinking:/ }),
    ).toBeNull();
  });

  it("does not render when both AI features are disabled", () => {
    enableFlags({ "ai-assistant": false, "component-search-v2": false });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-4.1-mini",
      }),
    );

    render(<AiModelQuickSelect />);

    expect(
      screen.queryByRole("button", { name: /^AI model and thinking:/ }),
    ).toBeNull();
  });

  it("shows configured model choices when component search is enabled", () => {
    enableFlags({ "component-search-v2": true });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-4.1-mini",
      }),
    );

    render(<AiModelQuickSelect />);

    fireEvent.click(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
    expect(screen.queryByText("Provider default")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "GPT-6 Astra" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "GPT-6 Sol" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "GPT-6 Luna" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "gpt-4.1-mini" }),
    ).toBeInTheDocument();
  });

  it("shows configured model choices when the AI assistant is enabled", () => {
    enableFlags({ "ai-assistant": true });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-4.1-mini",
      }),
    );

    render(<AiModelQuickSelect />);

    expect(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    ).toBeInTheDocument();
  });

  it("shows Sol with High thinking in proxy mode", () => {
    enableFlags({ "ai-assistant": true });
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    render(<AiModelQuickSelect />);
    expect(
      screen.getByRole("button", {
        name: "AI model and thinking: GPT-6 Sol, High",
      }),
    ).toBeInTheDocument();
  });
});

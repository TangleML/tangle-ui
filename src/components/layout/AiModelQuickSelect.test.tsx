import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_USE_OWN_KEY_STORAGE_KEY } from "@/hooks/useAiProviderSettings";

import { AiModelQuickSelect } from "./AiModelQuickSelect";

const STORAGE_KEY = "tangle.aiProvider.config";
const FLAGS_STORAGE_KEY = "betaFlags";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
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

    expect(screen.queryByRole("combobox", { name: "AI model" })).toBeNull();
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

    expect(screen.queryByRole("combobox", { name: "AI model" })).toBeNull();
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

    fireEvent.click(screen.getByRole("combobox", { name: "AI model" }));

    expect(
      screen.getByRole("option", { name: "Provider default" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "GPT-5.5" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GPT-4.1 mini" }),
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
      screen.getByRole("combobox", { name: "AI model" }),
    ).toBeInTheDocument();
  });

  it("shows the provider default and lets users return to it in proxy mode", () => {
    enableFlags({ "ai-assistant": true });
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    render(<AiModelQuickSelect />);

    const select = screen.getByRole("combobox", { name: "AI model" });
    expect(select).toHaveTextContent("Provider default");
    fireEvent.click(select);
    fireEvent.click(screen.getByRole("option", { name: "GPT-5.5" }));
    expect(select).toHaveTextContent("GPT-5.5");

    fireEvent.click(select);
    fireEvent.click(screen.getByRole("option", { name: "Provider default" }));

    expect(select).toHaveTextContent("Provider default");
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "").model,
    ).toBe("");
  });
});

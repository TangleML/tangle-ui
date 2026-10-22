import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_USE_OWN_KEY_STORAGE_KEY } from "@/hooks/useAiProviderSettings";

import { AiModelQuickSelect } from "./AiModelQuickSelect";

const STORAGE_KEY = "tangle.aiProvider.config";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

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
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");

    render(<AiModelQuickSelect />);

    expect(
      screen.queryByRole("button", { name: /^AI model and thinking:/ }),
    ).toBeNull();
  });

  it("shows configured model choices", () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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

    fireEvent.click(screen.getByRole("button", { name: /^Choose a model:/ }));
    expect(
      screen.getByRole("radio", { name: "gpt-4.1-mini" }),
    ).toBeInTheDocument();
  });

  it("shows the first model with High thinking in proxy mode by default", () => {
    render(<AiModelQuickSelect />);
    expect(
      screen.getByRole("button", {
        name: "AI model and thinking: GPT-6 Astra, High",
      }),
    ).toBeInTheDocument();
  });
});

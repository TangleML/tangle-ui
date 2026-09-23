import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiModelQuickSelect } from "./AiModelQuickSelect";

const STORAGE_KEY = "tangle.aiProvider.config";
const BACKEND_MODEL_STORAGE_KEY = "tangle.aiProvider.backendModel";
const BACKEND_REASONING_STORAGE_KEY =
  "tangle.aiProvider.backendReasoningEffort";
const FLAGS_STORAGE_KEY = "betaFlags";
const backend = vi.hoisted(() => ({ url: "" }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: backend.url }),
}));

function enableFlags(flags: Record<string, boolean>) {
  window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(flags));
}

describe("AiModelQuickSelect", () => {
  beforeEach(() => {
    window.localStorage.clear();
    backend.url = "";
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("does not render until AI provider settings are configured", () => {
    enableFlags({ "ai-assistant": true });

    render(<AiModelQuickSelect />);

    expect(screen.queryByRole("button", { name: "AI model" })).toBeNull();
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

    expect(screen.queryByRole("button", { name: "AI model" })).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "AI model" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Choose model" }));

    expect(screen.getByRole("option", { name: "Default" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GPT-6 Sol" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GPT-6 Astra" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GPT-6 Luna" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(4);
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
      screen.getByRole("button", { name: "AI model" }),
    ).toBeInTheDocument();
  });

  it("shows provider default when a manual proxy owns model selection", () => {
    enableFlags({ "ai-assistant": true });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "",
      }),
    );

    render(<AiModelQuickSelect />);

    const selector = screen.getByRole("button", { name: "AI model" });
    expect(selector).toHaveTextContent("Provider default");
    expect(selector).toHaveAttribute("title", "AI model: Provider default");
  });

  it("shows the actual backend default and lets the user change it without manual setup", () => {
    backend.url = "https://backend.example.com";
    enableFlags({ "ai-assistant": true });
    render(<AiModelQuickSelect />);
    const selector = screen.getByRole("button", { name: "AI model" });
    expect(selector).toHaveTextContent("gpt-6-sol");
    expect(selector).toHaveAttribute("title", "AI model: GPT-6 Sol · High");
    fireEvent.click(selector);
    fireEvent.click(screen.getByRole("combobox", { name: "Choose model" }));
    fireEvent.click(screen.getByRole("option", { name: "GPT-6 Astra" }));
    expect(selector).toHaveTextContent("gpt-6-astra");
    fireEvent.keyDown(screen.getByRole("slider"), { key: "End" });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(BACKEND_MODEL_STORAGE_KEY) ?? ""),
    ).toBe("gpt-6-astra");
    expect(
      JSON.parse(
        window.localStorage.getItem(BACKEND_REASONING_STORAGE_KEY) ?? "",
      ),
    ).toBe("max");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset to GPT-6 Sol and High thinking",
      }),
    );
    expect(selector).toHaveTextContent("gpt-6-sol");
    expect(
      JSON.parse(
        window.localStorage.getItem(BACKEND_REASONING_STORAGE_KEY) ?? "",
      ),
    ).toBe("high");
  });
});

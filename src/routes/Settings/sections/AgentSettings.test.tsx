import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_USE_OWN_KEY_STORAGE_KEY } from "@/hooks/useAiProviderSettings";

import { AgentSettings } from "./AgentSettings";

const STORAGE_KEY = "tangle.aiProvider.config";
const mockNotify = vi.fn();
const mockFetch = vi.fn();
const backend = vi.hoisted(() => ({ backendUrl: "" }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

describe("AgentSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
    mockNotify.mockClear();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    backend.backendUrl = "https://backend.example.com";
  });

  afterEach(() => {
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  it("switches to the selected backend proxy and restores the saved provider when switched back", async () => {
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-personal",
      model: "gpt-5-mini",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    const toggle = screen.getByRole("switch", { name: "Bring your own key" });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("API base URL")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Backend AI proxy: https://backend.example.com/api/experimental/ai/v1",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "Backend AI proxy is working.",
        "success",
      ),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://backend.example.com/api/experimental/ai/v1/responses",
      expect.objectContaining({
        credentials: "include",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(JSON.stringify(mockFetch.mock.calls)).not.toContain("sk-personal");
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual(
      savedConfig,
    );

    fireEvent.click(toggle);
    expect(screen.getByLabelText("API base URL")).toHaveValue(
      savedConfig.apiBase,
    );
    expect(screen.getByLabelText("API key")).toHaveValue(savedConfig.apiKey);
  });

  it("can test the proxy without entering a personal key, URL, or model", async () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    expect(
      screen.getByRole("switch", { name: "Bring your own key" }),
    ).not.toBeChecked();
    expect(screen.getByText("Status: configured ✅")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "Backend AI proxy is working.",
        "success",
      ),
    );
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).not.toHaveProperty(
      "model",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("lets the backend choose the model after the model field is cleared", async () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ model: "gpt-5-mini" }),
    );
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "" },
    });
    expect(screen.getByLabelText("Model id")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).not.toHaveProperty(
      "model",
    );
  });

  it("guides users to backend settings when no backend is selected", () => {
    backend.backendUrl = "";
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    render(<AgentSettings />);

    expect(
      screen.getByText(/Status: not configured. Select a backend/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Configure a backend in Settings → Backend before testing AI.",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("ignores an in-flight proxy test after the backend changes", async () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    let finishTest!: (response: Response) => void;
    mockFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishTest = resolve;
      }),
    );
    const { rerender } = render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));

    backend.backendUrl = "https://other.example.com";
    rerender(<AgentSettings />);
    await act(async () =>
      finishTest(new Response(JSON.stringify({ ok: true }))),
    );

    expect(mockNotify).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Test AI" })).toBeEnabled();
    expect(
      screen.getByText(
        "Backend AI proxy: https://other.example.com/api/experimental/ai/v1",
      ),
    ).toBeInTheDocument();
  });

  it("ignores an in-flight provider test after the mode changes", async () => {
    let finishTest!: (response: Response) => void;
    mockFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishTest = resolve;
      }),
    );
    render(<AgentSettings />);
    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));
    fireEvent.click(screen.getByRole("switch", { name: "Bring your own key" }));
    await act(async () =>
      finishTest(new Response(JSON.stringify({ ok: true }))),
    );

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Test AI" })).toBeEnabled();
  });

  it("shows inline feedback instead of saving when API base URL is blank", () => {
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an API base URL before continuing.",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalledWith(
      expect.stringContaining("AI provider settings saved"),
      "success",
    );
  });

  it("saves after testing the Responses API path used by AI generation", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" },
    });
    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "gpt-4o-mini" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        "AI provider settings saved. Model “gpt-4o-mini” works with the Responses API.",
        "success",
      );
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/responses",
      expect.objectContaining({ method: "POST" }),
    );
    const init = mockFetch.mock.calls[0]?.[1];
    if (typeof init !== "object" || init === null || !("body" in init)) {
      throw new Error("Expected fetch init with a body");
    }
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-4o-mini",
      max_output_tokens: 32,
      text: { format: { type: "json_object" } },
    });
    expect(JSON.stringify(init)).toContain("Bearer sk-test");
  });

  it("renders injectable model suggestions for the freeform model input", () => {
    window.__TANGLE_AI_MODELS__ = {
      defaultModel: "proxy-frontier",
      models: [
        {
          id: "proxy-frontier",
          label: "Proxy frontier",
          description: "Default proxy model",
        },
      ],
    };

    render(<AgentSettings />);

    expect(screen.getByLabelText("Model id")).toHaveAttribute(
      "placeholder",
      "e.g. proxy-frontier",
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Select a model" }));

    expect(
      screen.getByRole("option", { name: "Proxy frontier" }),
    ).toBeInTheDocument();
  });

  it("updates saved model settings as the model field changes", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-5",
      }),
    );

    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "gpt-5.5" },
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "",
      model: "gpt-5.5",
    });
  });

  it("syncs the model field when another control updates saved AI settings", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-5",
      }),
    );

    render(<AgentSettings />);

    expect(screen.getByLabelText("Model id")).toHaveValue("gpt-5");

    act(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiBase: "https://api.example.com/v1",
          apiKey: "",
          model: "gpt-5.5",
        }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Model id")).toHaveValue("gpt-5.5");
    });
  });

  it("reports an error and does not save provider details when the Responses API is not supported", async () => {
    mockFetch.mockResolvedValue(
      new Response("Endpoint not supported: /v1/responses", {
        status: 404,
        statusText: "Not Found",
      }),
    );
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "claude-opus" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        "AI test failed: 404 Not Found — Endpoint not supported: /v1/responses",
        "error",
      );
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      apiBase: "",
      apiKey: "",
      model: "claude-opus",
    });
  });

  it("saves after a successful provider-default AI test when API key and model are blank", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? ""),
      ).toEqual({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "",
      });
    });
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings saved. The provider works with the Responses API.",
      "success",
    );
  });

  it("allows clearing partially configured settings", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
      }),
    );

    render(<AgentSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings cleared",
      "success",
    );
  });
});

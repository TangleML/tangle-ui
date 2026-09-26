import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAiModelOptions } from "@/config/aiModels";
import { AI_USE_OWN_KEY_STORAGE_KEY } from "@/hooks/useAiProviderSettings";
import { useAvailableAiModels } from "@/hooks/useAvailableAiModels";
import { resolveAiResponsesModel } from "@/services/aiModelService";

import { AgentSettings } from "./AgentSettings";

const STORAGE_KEY = "tangle.aiProvider.config";
const mockNotify = vi.fn();
const mockFetch = vi.fn();
const backend = vi.hoisted(() => ({ backendUrl: "" }));

vi.mock("@/services/aiModelService", () => ({
  resolveAiResponsesModel: vi.fn(),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/hooks/useAvailableAiModels", () => ({
  useAvailableAiModels: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

describe("AgentSettings", () => {
  beforeEach(() => {
    vi.mocked(useAvailableAiModels)
      .mockReset()
      .mockImplementation(() => ({
        options: getAiModelOptions(),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }));
    vi.mocked(resolveAiResponsesModel)
      .mockReset()
      .mockImplementation(async ({ model }) => model);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
    mockNotify.mockClear();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    backend.backendUrl = "https://backend.example.com";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("tests the proxy with Sol and High thinking without personal provider details", async () => {
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
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      model: "gpt-6-sol",
      reasoning: { effort: "high" },
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("replaces a previously blank model with Sol when testing the proxy", async () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: "" }));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      model: "gpt-6-sol",
      reasoning: { effort: "high" },
    });
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

  it("tests the effective effort without overwriting the saved thinking preference", async () => {
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-6-astra",
      reasoningEffort: "none",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));
    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).reasoning).toEqual({
      effort: "low",
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual(
      savedConfig,
    );
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

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

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
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
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

  it("discovers models using unsaved provider credentials before testing", async () => {
    vi.mocked(useAvailableAiModels).mockImplementation((config) => ({
      options:
        config.apiBase === "https://new.example.com/v1" &&
        config.apiKey === "new-key"
          ? [{ id: "gpt-6-luna", label: "GPT-6 Luna" }]
          : [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://new.example.com/v1/" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "new-key" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Choose another model" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "GPT-6 Luna" }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringContaining("settings saved"),
        "success",
      ),
    );
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? ""),
    ).toMatchObject({
      apiBase: "https://new.example.com/v1",
      apiKey: "new-key",
      model: "gpt-6-luna",
    });
  });

  it.each(["API base URL", "API key"])(
    "does not send a stale test request after editing %s during discovery",
    async (field) => {
      let finishDiscovery!: (model: string) => void;
      vi.mocked(resolveAiResponsesModel).mockReturnValue(
        new Promise((resolve) => {
          finishDiscovery = resolve;
        }),
      );
      render(<AgentSettings />);
      fireEvent.change(screen.getByLabelText("API base URL"), {
        target: { value: "https://api.example.com/v1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));
      fireEvent.change(screen.getByLabelText(field), {
        target: {
          value: field === "API key" ? "new-key" : "https://new.example.com/v1",
        },
      });
      await act(async () => finishDiscovery("gpt-6-sol"));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Save and test AI" }),
      ).toBeEnabled();
    },
  );

  it("tests the callable route while preserving the friendly model selection", async () => {
    vi.mocked(resolveAiResponsesModel).mockResolvedValue(
      "responses-provider:deployed-model",
    );
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ model: "gpt-6-sol", reasoningEffort: "max" }),
    );
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "Backend AI proxy is working.",
        "success",
      ),
    );
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({
      model: "responses-provider:deployed-model",
      reasoning: { effort: "max" },
    });
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "").model,
    ).toBe("gpt-6-sol");
  });

  it("does not send a test request if the provider changes during model discovery", async () => {
    let finishDiscovery!: (model: string) => void;
    vi.mocked(resolveAiResponsesModel).mockReturnValue(
      new Promise((resolve) => {
        finishDiscovery = resolve;
      }),
    );
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    const { rerender } = render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Test AI" }));
    backend.backendUrl = "https://other.example.com";
    rerender(<AgentSettings />);
    await act(async () => finishDiscovery("responses-provider:model"));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
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
    fireEvent.click(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
    fireEvent.click(screen.getByRole("button", { name: "GPT-6 Luna" }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        "AI provider settings saved. Model “gpt-6-luna” works with the Responses API.",
        "success",
      );
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-6-luna",
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
      model: "gpt-6-luna",
      max_output_tokens: 2048,
      reasoning: { effort: "high" },
      text: { format: { type: "json_object" } },
    });
    expect(JSON.stringify(init)).toContain("Bearer sk-test");
  });

  it("renders model choices supplied by the host", () => {
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

    expect(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    ).toHaveTextContent("Proxy frontier");

    fireEvent.click(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));

    expect(
      screen.getByRole("button", { name: "Proxy frontier" }),
    ).toBeInTheDocument();
  });

  it("updates saved model settings when a model is selected", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-5",
      }),
    );

    render(<AgentSettings />);

    fireEvent.click(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
    fireEvent.click(screen.getByRole("button", { name: "GPT-6 Sol" }));

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      apiBase: "https://api.example.com/v1",
      apiKey: "",
      model: "gpt-6-sol",
    });
  });

  it("syncs the picker when another control updates saved AI settings", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "gpt-5",
      }),
    );

    render(<AgentSettings />);

    expect(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    ).toHaveTextContent("gpt-5");

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
      expect(
        screen.getByRole("button", { name: /^AI model and thinking:/ }),
      ).toHaveTextContent("gpt-5.5");
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

    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        "AI test failed: 404 Not Found — Endpoint not supported: /v1/responses",
        "error",
      );
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("saves after a successful AI test using the default model and thinking", async () => {
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
      "AI provider settings saved. Model “gpt-6-sol” works with the Responses API.",
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

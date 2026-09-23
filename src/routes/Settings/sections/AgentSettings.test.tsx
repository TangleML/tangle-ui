import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSettings } from "./AgentSettings";

const STORAGE_KEY = "tangle.aiProvider.config";
const MANUAL_CONFIGURATION_STORAGE_KEY = "tangle.aiProvider.manuallyConfigured";
const backend = vi.hoisted(() => ({ url: "" }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: backend.url }),
}));
const mockNotify = vi.fn();
const mockFetch = vi.fn<typeof fetch>();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

describe("AgentSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(MANUAL_CONFIGURATION_STORAGE_KEY, "true");
    backend.url = "";
    delete window.__TANGLE_AI_MODELS__;
    mockNotify.mockClear();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
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
      text: { format: { type: "json_object" } },
    });
    expect(JSON.stringify(init)).toContain("Bearer sk-test");
    expect(JSON.parse(String(init.body))).not.toHaveProperty(
      "max_output_tokens",
    );
    expect(init.credentials).toBe("omit");
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

  it("saves a manual proxy without an API key", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });

    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "custom-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? ""),
      ).toEqual({
        apiBase: "https://api.example.com/v1",
        apiKey: "",
        model: "custom-model",
      });
    });
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings saved. Model “custom-model” works with the Responses API.",
      "success",
    );
    const init = mockFetch.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(init?.credentials).toBe("omit");
  });

  it("tests backend AI with login credentials without saving fallback settings", async () => {
    window.localStorage.removeItem(MANUAL_CONFIGURATION_STORAGE_KEY);
    backend.url = "https://backend.example.com";
    window.localStorage.setItem(
      "jwtToken",
      JSON.stringify({ original_token: "login-token" }),
    );
    mockFetch.mockResolvedValue(Response.json({ output_text: '{"ok": true}' }));
    render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Test backend AI" }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "The Tangle backend works with the Responses API.",
        "success",
      ),
    );
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://backend.example.com/api/experimental/ai/v1/responses",
    );
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer login-token",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([401, 403, 404, 502])(
    "surfaces backend HTTP %s without switching providers",
    async (status) => {
      window.localStorage.removeItem(MANUAL_CONFIGURATION_STORAGE_KEY);
      backend.url = "https://backend.example.com";
      mockFetch.mockResolvedValue(new Response("AI unavailable", { status }));
      render(<AgentSettings />);
      fireEvent.click(screen.getByRole("button", { name: "Test backend AI" }));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          expect.stringContaining(`AI test failed: ${status}`),
          "error",
        ),
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(screen.getByRole("switch")).not.toBeChecked();
    },
  );

  it("does not test AI without a backend or custom provider", () => {
    window.localStorage.removeItem(MANUAL_CONFIGURATION_STORAGE_KEY);
    render(<AgentSettings />);
    expect(
      screen.getByRole("button", { name: "Test backend AI" }),
    ).toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not send login credentials to a custom provider with the backend path", async () => {
    window.localStorage.setItem(
      "jwtToken",
      JSON.stringify({ original_token: "login-token" }),
    );
    mockFetch.mockResolvedValue(Response.json({ ok: true }));
    render(<AgentSettings />);
    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://custom.example.com/api/experimental/ai/v1" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "custom-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(expect.any(String), "success"),
    );
    const init = mockFetch.mock.calls[0]?.[1];
    expect(init?.credentials).toBe("omit");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer custom-key",
    );
  });

  it.each(["max_output_tokens", "content_filter"])(
    "rejects incomplete %s test responses",
    async (reason) => {
      window.localStorage.removeItem(MANUAL_CONFIGURATION_STORAGE_KEY);
      backend.url = "https://backend.example.com";
      mockFetch.mockResolvedValue(
        Response.json({
          status: "incomplete",
          incomplete_details: { reason },
          output_text: '{"ok": true}',
        }),
      );
      render(<AgentSettings />);
      fireEvent.click(screen.getByRole("button", { name: "Test backend AI" }));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          expect.stringContaining("AI test failed:"),
          "error",
        ),
      );
      expect(mockNotify).not.toHaveBeenCalledWith(expect.anything(), "success");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    },
  );

  it("cancels a pending test and ignores its result after a backend change", async () => {
    window.localStorage.removeItem(MANUAL_CONFIGURATION_STORAGE_KEY);
    backend.url = "https://first.example.com";
    let finishTest: (response: Response) => void = () => {};
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishTest = resolve;
        }),
    );
    const { rerender } = render(<AgentSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Test backend AI" }));
    const signal = mockFetch.mock.calls[0]?.[1]?.signal;
    backend.url = "https://second.example.com";
    rerender(<AgentSettings />);
    expect(signal?.aborted).toBe(true);
    await act(async () => finishTest(Response.json({ ok: true })));
    expect(mockNotify).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Test backend AI" }),
    ).toBeEnabled();
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

  it("uses the backend by default and only shows the manual form when enabled", () => {
    window.localStorage.removeItem(MANUAL_CONFIGURATION_STORAGE_KEY);
    backend.url = "https://backend.example.com";
    render(<AgentSettings />);
    const toggle = screen.getByRole("switch", { name: "Manually configured" });
    expect(toggle).not.toBeChecked();
    expect(screen.getByLabelText("API base URL")).not.toBeVisible();
    expect(screen.getByText("Status: using the Tangle backend.")).toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByLabelText("API base URL")).toBeVisible();
    expect(screen.getByLabelText("API base URL")).toHaveValue("");
    expect(screen.getByLabelText("Model id")).toHaveValue("");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("keeps manual settings when toggling the backend on and off", () => {
    const config = {
      apiBase: "https://custom.example/v1",
      apiKey: "saved-key",
      model: "gpt-5.5",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    render(<AgentSettings />);
    const toggle = screen.getByRole("switch", { name: "Manually configured" });
    fireEvent.click(toggle);
    expect(screen.getByLabelText("API base URL")).not.toBeVisible();
    fireEvent.click(toggle);
    expect(screen.getByLabelText("API base URL")).toHaveValue(config.apiBase);
    expect(screen.getByLabelText("API key")).toHaveValue(config.apiKey);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual(
      config,
    );
  });

  it("allows a manual proxy to own model selection", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://custom.example/v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));

    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? ""),
      ).toEqual({
        apiBase: "https://custom.example/v1",
        apiKey: "",
        model: "",
      });
    });
    expect(
      JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body)),
    ).not.toHaveProperty("model");
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings saved. The provider works with the Responses API.",
      "success",
    );
  });

  it("does not save a pending test after switching back to the backend", async () => {
    let finishTest: (response: Response) => void = () => {};
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishTest = resolve;
        }),
    );
    render(<AgentSettings />);
    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://custom.example/v1" },
    });
    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "gpt-5.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and test AI" }));
    fireEvent.click(
      screen.getByRole("switch", { name: "Manually configured" }),
    );
    await act(async () => {
      finishTest(Response.json({ ok: true }));
    });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      apiBase: "",
      apiKey: "",
      model: "gpt-5.5",
    });
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

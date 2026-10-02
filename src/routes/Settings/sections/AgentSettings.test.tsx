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

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const requestBody = () => JSON.parse(mockFetch.mock.calls[0][1].body);
const readSavedConfig = () =>
  JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "");
const editField = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });

function openModels() {
  fireEvent.click(
    screen.getByRole("button", { name: /^AI model and thinking:/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
}

function chooseModel(name: string) {
  openModels();
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("AgentSettings", () => {
  beforeEach(() => {
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
    vi.stubGlobal("fetch", mockFetch);
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

  it("tests the proxy with default model and thinking without personal provider details", async () => {
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
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: "gpt-6-sol",
      reasoning: { effort: "high" },
    });
    expect(body).not.toHaveProperty("max_output_tokens");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
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

  it.each([
    { model: "gpt-6-astra", preference: "none", effort: "low" },
    { model: "gpt-6-sol", preference: "max", effort: "max" },
  ])(
    "tests $model with $effort thinking and preserves $preference",
    async ({ model, preference, effort }) => {
      const savedConfig = {
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model,
        reasoningEffort: preference,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      render(<AgentSettings />);
      fireEvent.click(button("Save and test AI"));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(requestBody().reasoning).toEqual({
        effort,
      });
      expect(readSavedConfig()).toEqual(savedConfig);
    },
  );

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

  it.each(["API base URL", "API key"])(
    "ignores an in-flight test after editing %s",
    async (field) => {
      let finishTest!: (response: Response) => void;
      mockFetch.mockReturnValue(
        new Promise<Response>((resolve) => {
          finishTest = resolve;
        }),
      );
      render(<AgentSettings />);
      editField("API base URL", "https://api.example.com/v1");
      fireEvent.click(button("Save and test AI"));
      editField(
        field,
        field === "API key" ? "new-key" : "https://new.example.com/v1",
      );
      await act(async () =>
        finishTest(new Response(JSON.stringify({ ok: true }))),
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(mockNotify).not.toHaveBeenCalled();
      expect(button("Save and test AI")).toBeEnabled();
    },
  );

  it("selects local models and tests draft credentials with the Responses API", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1/" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" },
    });
    chooseModel("GPT-6 Luna");
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(mockFetch).not.toHaveBeenCalled();
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
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      "https://api.example.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer sk-test",
        },
      }),
    );
    const body = requestBody();
    expect(body).toMatchObject({
      model: "gpt-6-luna",
      reasoning: { effort: "high" },
      text: { format: { type: "json_object" } },
    });
    expect(body).not.toHaveProperty("max_output_tokens");
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

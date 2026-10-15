import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_PROXY_STORAGE_KEY,
  AI_USE_OWN_KEY_STORAGE_KEY,
} from "@/hooks/useAiProviderSettings";

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
function editField(name: string, value: string) {
  if (name === "Model ID") {
    openModels();
    fireEvent.click(button("Custom model…"));
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
    fireEvent.click(button("Use model"));
    return;
  }
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
}

function openModels() {
  if (!screen.queryByRole("dialog")) {
    fireEvent.click(button(/^AI model and thinking:/));
  }
  fireEvent.click(button(/^Choose a model:/));
}

function chooseModel(name: string) {
  openModels();
  fireEvent.click(screen.getByRole("radio", { name }));
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
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "true");
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

  it("discards an unfinished custom model when switching modes with the same saved model", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ model: "gpt-6-sol" }),
    );
    window.localStorage.setItem(
      AI_PROXY_STORAGE_KEY,
      JSON.stringify({ model: "gpt-6-sol" }),
    );
    render(<AgentSettings />);
    editField("Model ID", "personal-draft");
    fireEvent.click(screen.getByRole("switch", { name: "Bring your own key" }));
    fireEvent.click(screen.getByRole("switch", { name: "Bring your own key" }));
    expect(button(/^AI model and thinking:/)).toHaveTextContent("GPT-6 Sol");
    expect(screen.queryByLabelText("Model ID")).not.toBeInTheDocument();
  });

  it("defaults to the proxy and the first listed model without personal provider details", async () => {
    window.localStorage.removeItem(AI_USE_OWN_KEY_STORAGE_KEY);
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
      model: "gpt-6-astra",
      reasoning: { effort: "high" },
    });
    expect(body.max_output_tokens).toBe(8224);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("tests Claude through the proxy with the selected thinking effort", async () => {
    window.localStorage.setItem(AI_USE_OWN_KEY_STORAGE_KEY, "false");
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_test",
          model: "claude-sonnet-5-5",
          content: [{ type: "text", text: '{"ok": true}' }],
          stop_reason: "end_turn",
        }),
      ),
    );
    render(<AgentSettings />);
    chooseModel("Claude Sonnet 5.5");
    fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
      key: "End",
    });
    expect(button(/^AI model and thinking:/)).toHaveTextContent(
      "Claude Sonnet 5.5 · Max",
    );
    fireEvent.click(button("Test AI"));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "Backend AI proxy is working.",
        "success",
      ),
    );
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      "https://backend.example.com/api/experimental/ai/anthropic/v1/messages",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(requestBody()).toMatchObject({
      model: "claude-sonnet-5-5",
      output_config: { effort: "max" },
    });
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROXY_STORAGE_KEY) ?? ""),
    ).toMatchObject({
      model: "claude-sonnet-5-5",
      reasoningEffortPreference: "max",
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

  it.each([
    { model: "gpt-6-astra", preference: "none", effort: "low" },
    { model: "gpt-6-sol", preference: "max", effort: "max" },
    { model: "gpt-6-sol", preference: "none", effort: "none" },
  ])(
    "tests $model with $effort thinking and preserves $preference",
    async ({ model, preference, effort }) => {
      const savedConfig = {
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model,
        reasoningEffortPreference: preference,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      render(<AgentSettings />);
      fireEvent.click(button("Save and test AI"));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(requestBody().reasoning).toEqual({
        effort,
      });
      expect(requestBody().max_output_tokens).toBe(
        effort === "none" ? 32 : 8224,
      );
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
    expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(button("Test AI")).toBeEnabled();
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
    expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(button("Test AI")).toBeEnabled();
    await act(async () =>
      finishTest(new Response(JSON.stringify({ ok: true }))),
    );

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Test AI" })).toBeEnabled();
  });

  it("handles provider mode persistence failures", async () => {
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
    expect(screen.getByRole("button", { name: "Testing…" })).toBeDisabled();

    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("Storage is unavailable");
      });
    try {
      const toggle = screen.getByRole("switch", { name: "Bring your own key" });
      fireEvent.click(toggle);
      expect(setItemSpy).toHaveBeenCalledWith(
        AI_USE_OWN_KEY_STORAGE_KEY,
        "false",
      );
      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
      expect(button("Save and test AI")).toBeEnabled();
      await act(async () =>
        finishTest(new Response(JSON.stringify({ ok: true }))),
      );

      expect(toggle).toBeChecked();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(mockNotify).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Save and test AI" }),
      ).toBeEnabled();
    } finally {
      setItemSpy.mockRestore();
    }
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

  it.each(["API base URL", "API key", "Model ID"])(
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
        field === "API base URL" ? "https://new.example.com/v1" : "new-value",
      );
      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
      expect(button("Save and test AI")).toBeEnabled();
      expect(mockFetch).toHaveBeenCalledOnce();
      await act(async () =>
        finishTest(new Response(JSON.stringify({ ok: true }))),
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(mockNotify).not.toHaveBeenCalled();
      expect(button("Save and test AI")).toBeEnabled();
    },
  );

  it("keeps a custom model local until its complete draft passes the connection test", async () => {
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-6-sol",
      reasoningEffortPreference: "high",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);

    for (const value of ["custom", "custom ", "custom model "]) {
      editField("Model ID", value);
      expect(readSavedConfig()).toEqual(savedConfig);
      expect(button(/^AI model and thinking:/)).toHaveTextContent(value.trim());
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    }
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(requestBody().model).toBe("custom model");
    expect(requestBody()).not.toHaveProperty("reasoning");
    expect(readSavedConfig()).toEqual({
      ...savedConfig,
      model: "custom model",
    });
    expect(screen.queryByLabelText("Model ID")).not.toBeInTheDocument();
    expect(button(/^AI model and thinking:/)).toHaveTextContent("custom model");
  });

  it("retains the active model and unfinished draft when testing fails", async () => {
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "",
      model: "gpt-6-sol",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    mockFetch.mockResolvedValue(new Response("Unknown model", { status: 400 }));
    render(<AgentSettings />);
    editField("Model ID", "custom-model");
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(readSavedConfig()).toEqual(savedConfig);
    expect(button(/^AI model and thinking:/)).toHaveTextContent("custom-model");
    expect(
      screen.getByText(/saved after a successful test/),
    ).toBeInTheDocument();
  });

  it("keeps a custom draft staged when it is reselected from the model list", () => {
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "",
      model: "gpt-6-sol",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    render(<AgentSettings />);
    editField("Model ID", "untested-custom");
    chooseModel("untested-custom");

    expect(readSavedConfig()).toEqual(savedConfig);
    expect(button(/^AI model and thinking:/)).toHaveTextContent(
      "untested-custom",
    );
    expect(
      screen.getByText(/saved after a successful test/),
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    { label: "GPT-6 Sol", id: "gpt-6-sol" },
    { label: "GPT-6 Luna", id: "gpt-6-luna" },
  ])(
    "replaces an unfinished model draft when selecting $label",
    ({ label, id }) => {
      render(<AgentSettings />);
      editField("Model ID", "unfinished");
      chooseModel(label);
      expect(button(/^AI model and thinking:/)).toHaveTextContent(label);
      expect(readSavedConfig().model).toBe(id);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it("resets an unfinished model draft on Clear", () => {
    render(<AgentSettings />);
    editField("Model ID", "unfinished");
    fireEvent.click(button("Clear"));
    expect(button(/^AI model and thinking:/)).toHaveTextContent("GPT-6 Astra");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("tests and saves a custom proxy model without exposing the saved personal provider", async () => {
    window.localStorage.removeItem(AI_USE_OWN_KEY_STORAGE_KEY);
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "sk-personal",
      model: "gpt-6-sol",
      reasoningEffort: "high",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    editField("Model ID", " custom-proxy-model ");
    expect(readSavedConfig()).toEqual(savedConfig);
    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith(
      "https://backend.example.com/api/experimental/ai/v1/responses",
      expect.objectContaining({
        credentials: "include",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(requestBody().model).toBe("custom-proxy-model");
    expect(requestBody()).not.toHaveProperty("reasoning");
    expect(JSON.stringify(mockFetch.mock.calls)).not.toContain("sk-personal");
    expect(readSavedConfig()).toEqual(savedConfig);
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROXY_STORAGE_KEY) ?? ""),
    ).toEqual({ model: "custom-proxy-model" });
    expect(button("Test AI")).toBeInTheDocument();
  });

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
    expect(body.max_output_tokens).toBe(8224);
  });

  it.each(["model", "thinking", "clear"])(
    "aborts the active check after changing %s",
    async (change) => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiBase: "https://api.example.com/v1",
          apiKey: "",
          model: "gpt-6-sol",
        }),
      );
      let finishTest!: (response: Response) => void;
      mockFetch.mockReturnValue(
        new Promise<Response>((resolve) => {
          finishTest = resolve;
        }),
      );
      render(<AgentSettings />);
      fireEvent.click(button("Save and test AI"));

      if (change === "model") {
        chooseModel("GPT-6 Luna");
      } else if (change === "thinking") {
        fireEvent.click(button(/^AI model and thinking:/));
        fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
          key: "End",
        });
      } else {
        fireEvent.click(button("Clear"));
        mockNotify.mockClear();
      }

      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
      expect(button("Save and test AI")).toBeEnabled();
      expect(mockFetch).toHaveBeenCalledOnce();
      await act(async () =>
        finishTest(new Response("Failed", { status: 500 })),
      );
      expect(mockNotify).not.toHaveBeenCalled();
      expect(button("Save and test AI")).toBeEnabled();
    },
  );

  it("can test new settings before the aborted request settles without releasing the new request's lock", async () => {
    let finishFirst!: (response: Response) => void;
    let finishSecond!: (response: Response) => void;
    mockFetch
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          finishSecond = resolve;
        }),
      );
    render(<AgentSettings />);
    editField("API base URL", "https://api.example.com/v1");
    fireEvent.click(button("Save and test AI"));
    const firstSignal = mockFetch.mock.calls[0][1].signal;
    expect(firstSignal.aborted).toBe(false);

    editField("API key", "sk-new");
    expect(firstSignal.aborted).toBe(true);
    expect(button("Save and test AI")).toBeEnabled();
    fireEvent.click(button("Save and test AI"));
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondSignal = mockFetch.mock.calls[1][1].signal;
    expect(secondSignal.aborted).toBe(false);

    await act(async () =>
      finishFirst(new Response(JSON.stringify({ ok: true }))),
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(button("Testing…")).toBeDisabled();
    fireEvent.submit(button("Testing…").closest("form")!);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(secondSignal.aborted).toBe(false);

    await act(async () =>
      finishSecond(new Response(JSON.stringify({ ok: true }))),
    );
    expect(readSavedConfig().apiKey).toBe("sk-new");
    expect(mockNotify).toHaveBeenCalledOnce();
    expect(button("Save and test AI")).toBeEnabled();
  });

  it("aborts an active test when unmounted and ignores its eventual result", async () => {
    let finishTest!: (response: Response) => void;
    mockFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishTest = resolve;
      }),
    );
    const { unmount } = render(<AgentSettings />);
    editField("API base URL", "https://api.example.com/v1");
    fireEvent.click(button("Save and test AI"));
    const signal = mockFetch.mock.calls[0][1].signal;
    unmount();
    expect(signal.aborted).toBe(true);

    await act(async () =>
      finishTest(new Response(JSON.stringify({ ok: true }))),
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("uses the first listed model when the saved model was blank", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ apiBase: "https://api.example.com/v1", model: "" }),
    );
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(requestBody().model).toBe("gpt-6-astra");
    expect(requestBody().reasoning).toEqual({ effort: "high" });
    expect(requestBody().max_output_tokens).toBe(8224);
    expect(readSavedConfig().model).toBe("gpt-6-astra");
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

  it("tests and saves a Claude draft with the saved effort using the native protocol and hint", async () => {
    const savedConfig = {
      apiBase: "https://api.example.com/v1",
      apiKey: "old-key",
      model: "gpt-6-sol",
      reasoningEffort: "medium",
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedConfig));
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_test",
          model: "claude-opus-5-5",
          content: [{ type: "text", text: '{"ok": true}' }],
          stop_reason: "end_turn",
        }),
      ),
    );
    render(<AgentSettings />);
    editField("API base URL", "https://api.anthropic.com/v1");
    editField("API key", "native-key");
    editField("Model ID", " claude-opus-5-5 ");

    expect(readSavedConfig()).toEqual(savedConfig);
    expect(button(/^AI model and thinking:/)).toHaveTextContent(
      "Claude Opus 5.5",
    );
    expect(screen.getByLabelText("API base URL")).toHaveAttribute(
      "placeholder",
      "https://api.anthropic.com/v1",
    );
    fireEvent.click(button("Save and test AI"));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "AI provider settings saved. Model “claude-opus-5-5” works with the Anthropic Messages API.",
        "success",
      ),
    );
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(requestBody().model).toBe("claude-opus-5-5");
    expect(requestBody().output_config).toEqual({ effort: "medium" });
    expect(readSavedConfig()).toEqual({
      apiBase: "https://api.anthropic.com/v1",
      apiKey: "native-key",
      model: "claude-opus-5-5",
      reasoningEffortPreference: "medium",
    });
  });

  it("redacts a native API key echoed in a failed Claude test", async () => {
    const apiKey = "sk-test.+native";
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: "authentication_error",
            message: `Invalid x-api-key: ${apiKey}`,
          },
        }),
        { status: 401, statusText: "Unauthorized" },
      ),
    );
    render(<AgentSettings />);
    editField("API base URL", "https://api.anthropic.com/v1");
    editField("API key", apiKey);
    chooseModel("Claude Opus 5.5");
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'AI test failed: 401 Unauthorized — {"error":{"type":"authentication_error","message":"Invalid x-api-key: ***"}}',
      "error",
    );
    expect(JSON.stringify(mockNotify.mock.calls)).not.toContain(apiKey);
  });

  it("tests Claude through an OpenAI-compatible gateway with the selected thinking effort", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    editField("API base URL", "https://gateway.example.com/v1");
    editField("API key", "gateway-key");
    chooseModel("Claude Opus 5.5");
    fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
      key: "Home",
    });
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith(
      "https://gateway.example.com/v1/responses",
      expect.objectContaining({
        headers: {
          "content-type": "application/json",
          authorization: "Bearer gateway-key",
        },
      }),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings saved. Model “claude-opus-5-5” works with the Responses API.",
      "success",
    );
    expect(requestBody().reasoning).toEqual({ effort: "low" });
    expect(requestBody()).not.toHaveProperty("output_config");
    expect(readSavedConfig().reasoningEffortPreference).toBe("low");
  });

  it("allows entering and reselecting a custom BYOK model ID", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AgentSettings />);
    editField("API base URL", "https://gateway.example.com/v1");
    editField("API key", "gateway-key");
    editField("Model ID", "custom-model");
    chooseModel("GPT-6 Sol");
    expect(button(/^AI model and thinking:/)).toHaveTextContent("GPT-6 Sol");
    editField("Model ID", "custom-model");
    fireEvent.click(button("Save and test AI"));

    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(requestBody().model).toBe("custom-model");
    expect(readSavedConfig().model).toBe("custom-model");
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
        model: "gpt-6-astra",
      });
    });
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings saved. Model “gpt-6-astra” works with the Responses API.",
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CONFIG, getDefaultAiModelId } from "@/config/aiConfig";
import {
  AI_PROVIDER_STORAGE_KEY,
  AI_PROXY_STORAGE_KEY,
  AI_USE_OWN_KEY_STORAGE_KEY,
} from "@/hooks/useAiProviderSettings";
import { useBackend } from "@/providers/BackendProvider";
import { rememberLastUsedWorkspace } from "@/services/projects/defaultWorkspace";
import { createProject } from "@/services/projects/projectsService";
import { startingSessionMetadata } from "@/services/projects/startingSession";
import type { Workspace } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { StartSessionPrompt } from "./StartSessionPrompt";

const navigate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: vi.fn(),
}));

vi.mock("@/services/projects/projectsService", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspaces: vi.fn(),
}));

vi.mock("./useMyProjects", () => ({
  useMyProjects: () => ({ projects: [{ name: "Project 1" }] }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const renderPrompt = () => render(<StartSessionPrompt />, { wrapper });

function mockAiConfigured(isConfigured: boolean) {
  localStorage.setItem(
    AI_USE_OWN_KEY_STORAGE_KEY,
    JSON.stringify(!isConfigured),
  );
}

async function type(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Start a new session"), text);
  return user;
}

const workspace = (id: string, name: string, createdAt: string): Workspace => ({
  id,
  name,
  description: null,
  isActive: true,
  metadata: null,
  createdAt: new Date(createdAt),
});

const research = workspace("ws-1", "Research", "2026-01-01T00:00:00Z");
const analytics = workspace("ws-2", "Analytics", "2026-06-01T00:00:00Z");

function mockWorkspaces(
  workspaces: Workspace[] | undefined,
  { isPending = false } = {},
) {
  vi.mocked(useWorkspaces).mockReturnValue({
    data: workspaces,
    isPending,
  } as unknown as ReturnType<typeof useWorkspaces>);
}

function mockBackend(overrides: Partial<ReturnType<typeof useBackend>> = {}) {
  vi.mocked(useBackend).mockReturnValue({
    backendUrl: "https://backend.example.com",
    configured: true,
    available: true,
    ready: true,
    ...overrides,
  } as ReturnType<typeof useBackend>);
}

async function pickWorkspace(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Workspace"));
  await user.click(screen.getByRole("option", { name }));
}

describe("StartSessionPrompt", () => {
  beforeEach(() => {
    // Radix's select measures and scrolls, neither of which jsdom does.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mockBackend();
    mockWorkspaces([research]);
    vi.mocked(createProject).mockResolvedValue({
      id: "project-9",
    } as unknown as Awaited<ReturnType<typeof createProject>>);
    mockAiConfigured(true);
  });
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  /**
   * The prompt rides on the project because Tangent runs it as the opening turn
   * of the session it starts for a project nobody has worked in yet.
   */
  it("hands the typed prompt to the project it creates", async () => {
    renderPrompt();

    await type("Build a churn model{Enter}");

    expect(createProject).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "Build a churn model",
      origin: "agent",
      metadata: {
        ...startingSessionMetadata({
          prompt: "Build a churn model",
          model: `openai/${getDefaultAiModelId()}`,
          thinkingDepth: AI_CONFIG.defaultReasoningEffort,
        }),
        startingRequestedAt: expect.any(String),
        provisionalName: true,
      },
    });
  });

  /** The agent replaces this name later; the mark is what lets it. */
  it("marks the name it derived as nobody's choice", async () => {
    renderPrompt();

    await type("Build a churn model{Enter}");

    const { metadata } = vi.mocked(createProject).mock.calls[0][0];
    expect(metadata).toMatchObject({ provisionalName: true });
  });

  it("falls back to a numbered name when the prompt is no title", async () => {
    renderPrompt();

    await type("hi{Enter}");

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Project 2" }),
    );
  });

  it("opens the project it made", async () => {
    renderPrompt();

    await type("Build a churn model{Enter}");

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ params: { projectId: "project-9" } }),
    );
  });

  it("starts from the send button as well as the keyboard", async () => {
    renderPrompt();

    const user = await type("Build a churn model");
    await user.click(screen.getByRole("button", { name: "Start session" }));

    expect(createProject).toHaveBeenCalledTimes(1);
  });

  it("makes nothing out of an empty prompt", async () => {
    renderPrompt();

    await type("   {Enter}");

    expect(createProject).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  /** A project is hard to un-create, so a double Enter must not make two. */
  it("does not start a second project while the first is being made", async () => {
    vi.mocked(createProject).mockReturnValue(new Promise(() => {}) as never);
    renderPrompt();

    await type("Build a churn model{Enter}{Enter}");

    expect(createProject).toHaveBeenCalledTimes(1);
  });

  /** A brief is more than one line, so a newline has to be typeable. */
  it("takes a newline on shift-enter instead of starting", async () => {
    renderPrompt();

    await type("First line{Shift>}{Enter}{/Shift}second line");

    expect(createProject).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Start a new session")).toHaveValue(
      "First line\nsecond line",
    );
  });

  it.each([
    ["GPT-6.1 Terra", "gpt-6.1-terra", "Home", "None", "off", "none"],
    ["GPT-6.1 Sol", "gpt-6.1-sol", "Home", "Low", "low", "low"],
    ["GPT-6.1 Sol", "gpt-6.1-sol", "End", "Extra high", "xhigh", "xhigh"],
  ])(
    "starts with the shared picker selection (%s, %s, %s)",
    async (modelLabel, model, key, label, depth, preference) => {
      renderPrompt();

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", { name: /^AI model and thinking:/ }),
      );
      await user.click(
        screen.getByRole("button", { name: /^Choose a model:/ }),
      );
      await user.click(screen.getByRole("radio", { name: modelLabel }));
      screen.getByRole("slider", { name: "Thinking" }).focus();
      await user.keyboard(`{${key}}`);
      expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
        "aria-valuetext",
        label,
      );
      await user.keyboard("{Escape}");
      await type("Build a churn model{Enter}");

      expect(vi.mocked(createProject).mock.calls[0][0].metadata).toMatchObject({
        startingThinkingDepth: depth,
        startingModel: `openai/${model}`,
      });
      expect(
        JSON.parse(localStorage.getItem(AI_PROXY_STORAGE_KEY) ?? "{}"),
      ).toMatchObject({
        model,
        reasoningEffortPreference: preference,
      });
    },
  );

  it("uses the saved model and thinking preferences", async () => {
    localStorage.setItem(
      AI_PROXY_STORAGE_KEY,
      JSON.stringify({
        model: "claude-sonnet-5-5",
        reasoningEffortPreference: "low",
      }),
    );
    renderPrompt();

    expect(
      screen.getByRole("button", {
        name: "AI model and thinking: Claude Sonnet 5.5, Low",
      }),
    ).toBeVisible();
    await type("Build a churn model{Enter}");

    expect(vi.mocked(createProject).mock.calls[0][0].metadata).toMatchObject({
      startingModel: "anthropic/claude-sonnet-5-5",
      startingThinkingDepth: "low",
    });
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith(
        "projects.start_session_completed",
        expect.objectContaining({ model: "anthropic/claude-sonnet-5-5" }),
      ),
    );
  });

  it.each([
    ["gpt-6.1-sol", "GPT-6.1 Sol", "Extra high", "xhigh", "3"],
    ["custom", "Custom", "High", "high", "1"],
  ])(
    "shows and submits the supported level for a saved Max preference (%s)",
    async (model, label, effortLabel, depth, maximum) => {
      if (model === "custom") {
        window.__TANGLE_AI_MODELS__ = {
          models: [
            { id: model, label, reasoningEfforts: ["low", "high", "max"] },
          ],
        };
      }
      const saved = JSON.stringify({ model, reasoningEffortPreference: "max" });
      localStorage.setItem(AI_PROXY_STORAGE_KEY, saved);
      renderPrompt();

      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", {
          name: `AI model and thinking: ${label}, ${effortLabel}`,
        }),
      );
      const slider = screen.getByRole("slider", { name: "Thinking" });
      expect(slider).toHaveAttribute("aria-valuetext", effortLabel);
      expect(slider).toHaveAttribute("aria-valuemax", maximum);
      expect(screen.getByText(/Your max preference is saved/)).toBeVisible();
      slider.focus();
      await user.keyboard("{Escape}");
      await type("Build a churn model{Enter}");

      expect(vi.mocked(createProject).mock.calls[0][0].metadata).toMatchObject({
        startingModel: `openai/${model}`,
        startingThinkingDepth: depth,
      });
      expect(localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBe(saved);
    },
  );

  /**
   * Tangent runs sessions through its own proxy, which cannot reach a model
   * only the user's provider knows, so the session starts on Tangent's default.
   */
  it.each([
    [false, "vendor/custom-model"],
    [false, "gemini-4-argon"],
    [true, "my-deployment"],
  ])(
    "leaves a typed-in model for Tangent to choose (own key: %s, %s)",
    async (ownKeyEnabled, model) => {
      localStorage.setItem(
        AI_USE_OWN_KEY_STORAGE_KEY,
        JSON.stringify(ownKeyEnabled),
      );
      localStorage.setItem(
        ownKeyEnabled ? AI_PROVIDER_STORAGE_KEY : AI_PROXY_STORAGE_KEY,
        JSON.stringify({ apiBase: "https://gateway.example.com/v1", model }),
      );
      renderPrompt();

      await type("Build a churn model{Enter}");

      const { metadata } = vi.mocked(createProject).mock.calls[0][0];
      expect(metadata).not.toHaveProperty("startingModel");
      expect(metadata).not.toHaveProperty("startingThinkingDepth");
      await waitFor(() =>
        expect(track).toHaveBeenCalledWith(
          "projects.start_session_completed",
          expect.objectContaining({ model: "custom" }),
        ),
      );
    },
  );

  it("offers no workspace to pick when there is only one", () => {
    renderPrompt();

    expect(screen.queryByLabelText("Workspace")).not.toBeInTheDocument();
  });

  describe("choosing a workspace", () => {
    beforeEach(() => mockWorkspaces([analytics, research]));

    it("marks the picker with the workspace icon, but not its options", async () => {
      renderPrompt();

      const picker = screen.getByLabelText("Workspace");
      expect(picker.querySelector("svg.lucide-shapes")).not.toBeNull();

      await userEvent.setup().click(picker);
      for (const option of screen.getAllByRole("option")) {
        expect(option.querySelector("svg.lucide-shapes")).toBeNull();
      }
    });

    it("starts the session in the workspace that was picked", async () => {
      renderPrompt();

      await pickWorkspace("Analytics");
      await type("Build a churn model{Enter}");

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-2" }),
      );
    });

    it("remembers the workspace for the next session", async () => {
      renderPrompt();

      await pickWorkspace("Analytics");
      await type("Build a churn model{Enter}");

      await waitFor(() =>
        expect(
          localStorage.getItem("tangle.projects.lastUsedWorkspaceId"),
        ).toBe(JSON.stringify("ws-2")),
      );
    });

    it("records whether the preselected workspace was changed", async () => {
      renderPrompt();

      await pickWorkspace("Analytics");
      await type("Build a churn model{Enter}");

      await waitFor(() =>
        expect(track).toHaveBeenCalledWith(
          "projects.start_session_completed",
          expect.objectContaining({ workspace_changed: true }),
        ),
      );
    });

    it("records the change against the default it was sent with", async () => {
      let finish: (project: { id: string }) => void = () => {};
      vi.mocked(createProject).mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }) as never,
      );
      renderPrompt();

      await pickWorkspace("Analytics");
      await type("Build a churn model{Enter}");
      act(() => rememberLastUsedWorkspace("ws-2"));
      finish({ id: "project-9" });

      await waitFor(() =>
        expect(track).toHaveBeenCalledWith(
          "projects.start_session_completed",
          expect.objectContaining({ workspace_changed: true }),
        ),
      );
    });
  });

  /**
   * The box is the page, so it stays standing when the backend cannot say
   * where a project would go — vanishing reads as the page being broken.
   */
  it("stands but cannot be used when there is nowhere to put a project", () => {
    mockWorkspaces([]);

    renderPrompt();

    expect(screen.getByLabelText("Start a new session")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Start session" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Projects cannot be created yet. Contact your Tangle Admin for help.",
      ),
    ).toBeVisible();
  });

  it("asks for a backend when none is connected", () => {
    mockBackend({ configured: false, available: false });
    mockWorkspaces(undefined, { isPending: true });

    renderPrompt();

    expect(
      screen.getByText(
        "Connect a backend to enable agentic features in Tangle",
      ),
    ).toBeVisible();
  });

  /** Arriving on this page is the act of wanting to type. */
  it("takes the caret as soon as it can accept one", () => {
    renderPrompt();

    expect(screen.getByLabelText("Start a new session")).toHaveFocus();
  });

  it("cannot be used before the backend has answered either", () => {
    mockWorkspaces(undefined, { isPending: true });

    renderPrompt();

    expect(screen.getByLabelText("Start a new session")).toBeDisabled();
    expect(screen.queryByText(/Projects cannot be created/)).toBeNull();
  });

  describe("without an AI provider", () => {
    beforeEach(() => mockAiConfigured(false));

    it("stands but cannot be used, and says how to fix it", () => {
      renderPrompt();

      expect(screen.getByLabelText("Start a new session")).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Start session" }),
      ).toBeDisabled();
      expect(screen.getByRole("link", { name: /AI settings/ })).toBeVisible();
    });

    it("makes no project even when the keyboard asks", async () => {
      renderPrompt();

      const user = userEvent.setup();
      await user.type(
        screen.getByLabelText("Start a new session"),
        "Build a churn model{Enter}",
      );

      expect(createProject).not.toHaveBeenCalled();
    });

    /**
     * A provider is a setting the user can change here and now; a backend may
     * not be theirs to fix, so the actionable one is the one shown.
     */
    it("says so ahead of a missing backend", () => {
      mockBackend({ configured: false, available: false });
      mockWorkspaces(undefined, { isPending: true });

      renderPrompt();

      expect(screen.queryByText(/Connect a backend/)).toBeNull();
      expect(screen.getByRole("link", { name: /AI settings/ })).toBeVisible();
    });
  });
});

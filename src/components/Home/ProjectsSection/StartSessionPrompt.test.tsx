import {
  DEFAULT_MODEL_ID,
  DEFAULT_THINKING_LEVEL,
} from "@tangent/shared/contracts.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProject } from "@/services/projects/projectsService";
import { startingSessionExtraData } from "@/services/projects/startingSession";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { StartSessionPrompt } from "./StartSessionPrompt";

const navigate = vi.fn();
const notify = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
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

async function type(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Start a new session"), text);
  return user;
}

describe("StartSessionPrompt", () => {
  beforeEach(() => {
    // Radix's select measures and scrolls, neither of which jsdom does.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [{ id: "ws-1", isActive: true }],
      isPending: false,
    } as unknown as ReturnType<typeof useWorkspaces>);
    vi.mocked(createProject).mockResolvedValue({
      id: "project-9",
    } as unknown as Awaited<ReturnType<typeof createProject>>);
  });
  afterEach(() => vi.resetAllMocks());

  /**
   * The prompt rides on the project because Tangent runs it as the opening turn
   * of the session it starts for a project nobody has worked in yet.
   */
  it("hands the typed prompt to the project it creates", async () => {
    renderPrompt();

    await type("Build a churn model{Enter}");

    expect(createProject).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "Project 2",
      origin: "agent",
      extraData: startingSessionExtraData({
        prompt: "Build a churn model",
        model: DEFAULT_MODEL_ID,
        thinkingDepth: DEFAULT_THINKING_LEVEL,
      }),
    });
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

  it("says why the backend refused rather than a generic failure", async () => {
    vi.mocked(createProject).mockRejectedValue(new Error("Quota exceeded"));
    renderPrompt();

    await type("Build a churn model{Enter}");

    expect(notify).toHaveBeenCalledWith("Quota exceeded", "error");
    expect(navigate).not.toHaveBeenCalled();
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

  it("starts the session on the model and depth that were chosen", async () => {
    renderPrompt();

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Thinking"));
    await user.click(screen.getByRole("option", { name: "High" }));
    await type("Build a churn model{Enter}");

    expect(vi.mocked(createProject).mock.calls[0][0].extraData).toMatchObject({
      startingThinkingDepth: "high",
      startingModel: DEFAULT_MODEL_ID,
    });
  });

  /**
   * The box is the page, so it stays standing when the backend cannot say
   * where a project would go — vanishing reads as the page being broken.
   */
  it("stands but cannot be used when there is nowhere to put a project", () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [],
      isPending: false,
    } as unknown as ReturnType<typeof useWorkspaces>);

    renderPrompt();

    expect(screen.getByLabelText("Start a new session")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Start session" }),
    ).toBeDisabled();
  });

  /** Arriving on this page is the act of wanting to type. */
  it("takes the caret as soon as it can accept one", () => {
    renderPrompt();

    expect(screen.getByLabelText("Start a new session")).toHaveFocus();
  });

  it("cannot be used before the backend has answered either", () => {
    vi.mocked(useWorkspaces).mockReturnValue({
      data: undefined,
      isPending: true,
    } as unknown as ReturnType<typeof useWorkspaces>);

    renderPrompt();

    expect(screen.getByLabelText("Start a new session")).toBeDisabled();
  });
});

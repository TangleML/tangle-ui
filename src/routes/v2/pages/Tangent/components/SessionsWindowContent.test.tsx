import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";

import { SessionsWindowContent } from "./SessionsWindowContent";

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const selectSession = vi.fn();
const renameSession = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({
    projectId: "project-1",
    activeSessionId: "session-1",
    isStartingSession: false,
    selectSession,
    startSession: vi.fn(),
  }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessions", () => ({
  useProjectSessions: vi.fn(),
}));

vi.mock("@/routes/v2/shared/components/AiChat/components/useAiGate", () => ({
  useAiGate: () => ({ disabled: false, title: "" }),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function session(sessionId: string, name: string | null, createdAt: string) {
  return {
    resourceId: `resource-${sessionId}`,
    sessionId,
    name,
    createdAt: new Date(createdAt),
  };
}

function given(...sessions: ReturnType<typeof session>[]) {
  vi.mocked(useProjectSessions).mockReturnValue({
    sessions,
    renameSession,
  } as unknown as ReturnType<typeof useProjectSessions>);
}

function renderSessions() {
  return render(
    <DialogProvider disableRouterSync>
      <SessionsWindowContent />
    </DialogProvider>,
  );
}

describe("SessionsWindowContent", () => {
  beforeEach(() => {
    given(
      session("session-1", null, "2026-09-22T10:00:00Z"),
      session("session-2", "Feature exploration", "2026-09-23T10:00:00Z"),
    );
  });
  afterEach(() => vi.resetAllMocks());

  it("numbers an unnamed session and shows a named one by its name", () => {
    renderSessions();

    expect(screen.getByText("Session 1")).toBeInTheDocument();
    expect(screen.getByText("Feature exploration")).toBeInTheDocument();
  });

  it("renames a session to what was typed", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));
    await user.type(screen.getByLabelText("Name"), "  Data cleanup  ");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() =>
      expect(renameSession).toHaveBeenCalledWith(
        "resource-session-1",
        "Data cleanup",
      ),
    );
    expect(notify).toHaveBeenCalledWith("Session renamed", "success");
  });

  it("prefills the dialog with an existing name", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.click(
      screen.getByRole("button", { name: "Rename Feature exploration" }),
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Feature exploration");
  });

  it("offers the numbered label as a placeholder for an unnamed session", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));

    const input = screen.getByLabelText("Name");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Session 1");
  });

  it("refuses an empty name", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.click(
      screen.getByRole("button", { name: "Rename Feature exploration" }),
    );
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();
    expect(renameSession).not.toHaveBeenCalled();
  });

  /**
   * `useUpdateProjectResource` already toasts on failure, so a complaint from
   * here as well would be two toasts for one rename.
   */
  it("leaves a failed rename for the mutation to report", async () => {
    renameSession.mockRejectedValueOnce(new Error("Session is gone"));
    const user = userEvent.setup();
    renderSessions();

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));
    await user.type(screen.getByLabelText("Name"), "Data cleanup");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(renameSession).toHaveBeenCalled());
    expect(notify).not.toHaveBeenCalled();
  });

  it("opening the rename dialog does not select the session", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));

    expect(selectSession).not.toHaveBeenCalled();
  });
});

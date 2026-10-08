import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";

import { SessionsWindowContent } from "./SessionsWindowContent";

const selectSession = vi.fn();
const renameSession = vi.fn();

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

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
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

describe("SessionsWindowContent", () => {
  beforeEach(() => {
    given(
      session("session-1", null, "2026-09-22T10:00:00Z"),
      session("session-2", "Feature exploration", "2026-09-23T10:00:00Z"),
    );
  });
  afterEach(() => vi.resetAllMocks());

  it("numbers an unnamed session and shows a named one by its name", () => {
    render(<SessionsWindowContent />);

    expect(screen.getByText("Session 1")).toBeInTheDocument();
    expect(screen.getByText("Feature exploration")).toBeInTheDocument();
  });

  it("renames a session to what was typed", async () => {
    const user = userEvent.setup();
    render(<SessionsWindowContent />);

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));
    await user.type(screen.getByLabelText("Name"), "  Data cleanup  ");
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(renameSession).toHaveBeenCalledWith(
      "resource-session-1",
      "Data cleanup",
    );
  });

  it("prefills the dialog with an existing name", async () => {
    const user = userEvent.setup();
    render(<SessionsWindowContent />);

    await user.click(
      screen.getByRole("button", { name: "Rename Feature exploration" }),
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Feature exploration");
  });

  it("offers the numbered label as a placeholder for an unnamed session", async () => {
    const user = userEvent.setup();
    render(<SessionsWindowContent />);

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));

    const input = screen.getByLabelText("Name");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Session 1");
  });

  it("refuses an empty name", async () => {
    const user = userEvent.setup();
    render(<SessionsWindowContent />);

    await user.click(
      screen.getByRole("button", { name: "Rename Feature exploration" }),
    );
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByText("Name cannot be empty")).toBeInTheDocument();
    expect(renameSession).not.toHaveBeenCalled();
  });

  it("opening the rename dialog does not select the session", async () => {
    const user = userEvent.setup();
    render(<SessionsWindowContent />);

    await user.click(screen.getByRole("button", { name: "Rename Session 1" }));

    expect(selectSession).not.toHaveBeenCalled();
  });
});

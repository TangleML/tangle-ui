import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";

import { ProjectSessionList } from "./ProjectSessionList";

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

vi.mock("@/routes/v2/pages/Tangent/hooks/useOpenTangentProject", () => ({
  useOpenTangentProject: () => openProject,
}));

const openProject = vi.fn();
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

function renderSessions(
  projectId = "project-1",
  onlySessionIds?: ReadonlySet<string>,
) {
  return render(
    <DialogProvider disableRouterSync>
      <ProjectSessionList
        projectId={projectId}
        onlySessionIds={onlySessionIds}
        runStates={new Map()}
      />
    </DialogProvider>,
  );
}

describe("ProjectSessionList", () => {
  beforeEach(() => {
    given(
      session("session-1", null, "2026-09-22T10:00:00Z"),
      session("session-2", "Feature exploration", "2026-09-23T10:00:00Z"),
    );
  });
  afterEach(() => vi.resetAllMocks());

  it("says which sessions have an agent working", () => {
    render(
      <DialogProvider disableRouterSync>
        <ProjectSessionList
          projectId="project-1"
          runStates={new Map([["session-2", "working"]])}
        />
      </DialogProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Feature exploration" }),
    ).toHaveAccessibleDescription("Working");
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Session 1" }),
    ).toBeInTheDocument();
  });

  it("says which sessions have a run that finished or failed unseen", () => {
    render(
      <DialogProvider disableRouterSync>
        <ProjectSessionList
          projectId="project-1"
          runStates={
            new Map([
              ["session-1", "finished"],
              ["session-2", "failed"],
            ])
          }
        />
      </DialogProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Session 1" }),
    ).toHaveAccessibleDescription("Finished");
    expect(
      screen.getByRole("button", { name: "Feature exploration" }),
    ).toHaveAccessibleDescription("Last run failed");
    expect(screen.queryByTestId("spinner")).toBeNull();
  });

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

  it("selects a session of the project in view where it is", async () => {
    const user = userEvent.setup();
    renderSessions();

    await user.click(screen.getByText("Feature exploration"));

    expect(selectSession).toHaveBeenCalledWith("session-2");
    expect(openProject).not.toHaveBeenCalled();
  });

  /** Its files and resources are that project's, so the page moves there. */
  it("opens another project's session in that project", async () => {
    const user = userEvent.setup();
    renderSessions("project-2");

    await user.click(screen.getByText("Feature exploration"));

    expect(selectSession).not.toHaveBeenCalled();
    expect(openProject).toHaveBeenCalledWith("project-2", {
      session: "session-2",
    });
  });

  it("lists every session a search matched, and only those", () => {
    const days = [1, 2, 3, 4, 5, 6, 7];
    given(
      ...days.map((day) =>
        session(`s-${day}`, `Backfill day ${day}`, `2026-01-0${day}`),
      ),
    );

    renderSessions(
      "project-1",
      new Set(days.slice(1).map((day) => `s-${day}`)),
    );

    expect(screen.queryByText("Backfill day 1")).toBeNull();
    for (const day of days.slice(1)) {
      expect(screen.getByText(`Backfill day ${day}`)).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});

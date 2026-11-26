import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteProjectAction } from "@/components/Project/useDeleteProjectAction";
import {
  type ProjectSession,
  useSessionsOfProjects,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { usePinnedProjects } from "@/services/projects/usePinnedProjects";
import { useProject } from "@/services/projects/useProjects";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { ProjectsWindowContent } from "./ProjectsWindowContent";

const openProject = vi.fn();
const cancelPendingProjectMove = vi.fn();
const startSession = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useOpenTangentProject", () => ({
  useOpenTangentProject: () => openProject,
  cancelPendingProjectMove: () => cancelPendingProjectMove(),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: () => ({ baseUrl: null }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useSessionRunStates", () => ({
  useSessionRunStates: () => new Map(),
}));

/** Stands in for the store's context, so a change re-renders the panel. */
const inView = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    projectId: "project-1",
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    changed() {
      version += 1;
      listeners.forEach((listener) => listener());
    },
  };
});

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useTangentProject: () => {
      useSyncExternalStore(inView.subscribe, inView.version);
      return {
        projectId: inView.projectId,
        isStartingSession: false,
        startSession,
      };
    },
  };
});

vi.mock("@/routes/v2/shared/components/AiChat/components/useAiGate", () => ({
  useAiGate: () => ({ disabled: false, title: "" }),
}));

vi.mock("@/services/projects/useReachableProjects", () => ({
  useReachableProjects: vi.fn(),
}));

vi.mock("@/services/projects/usePinnedProjects", () => ({
  usePinnedProjects: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
}));

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspaces: vi.fn(),
}));

vi.mock("@/components/Home/ProjectsSection/CreateProjectDialog", () => ({
  CreateProjectDialog: () => null,
}));

vi.mock("@/components/Project/ProjectMenu", () => ({
  ProjectMenu: ({ project }: { project: { name: string } }) => (
    <button type="button" aria-label={`Project actions: ${project.name}`} />
  ),
}));

vi.mock("@/components/Project/useRenameProjectAction", () => ({
  useRenameProjectAction: () => vi.fn(),
}));

vi.mock("@/components/Project/useDeleteProjectAction", () => ({
  useDeleteProjectAction: vi.fn(),
}));

vi.mock("@/components/shared/Dialogs", () => ({
  ConfirmationDialog: () => null,
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessions", () => ({
  useSessionsOfProjects: vi.fn(),
}));

vi.mock("./ProjectSessionList", () => ({
  ProjectSessionList: ({
    projectId,
    onlySessionIds,
  }: {
    projectId: string;
    onlySessionIds?: ReadonlySet<string>;
  }) => (
    <div data-testid={`sessions-${projectId}`}>
      {onlySessionIds && `only ${[...onlySessionIds].join(", ")}`}
    </div>
  ),
}));

const RESEARCH = { id: "ws-research", name: "Research" };
const OPERATIONS = { id: "ws-operations", name: "Operations" };

const CHURN = {
  id: "project-1",
  name: "Churn model",
  workspaceId: RESEARCH.id,
};
const FORECAST = {
  id: "project-2",
  name: "Q3 forecasting",
  workspaceId: RESEARCH.id,
};
const PRICING = {
  id: "project-3",
  name: "Pricing experiments",
  workspaceId: OPERATIONS.id,
};

const BACKFILL: ProjectSession = {
  resourceId: "resource-s-3",
  sessionId: "s-3",
  name: "Backfill March",
  createdAt: new Date("2026-01-03"),
};

function given(reachable: (typeof CHURN)[], inView = CHURN) {
  vi.mocked(useReachableProjects).mockReturnValue({
    projects: reachable,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useReachableProjects>);
  vi.mocked(useProject).mockReturnValue({
    data: inView,
  } as unknown as ReturnType<typeof useProject>);
}

const searchBox = () =>
  screen.getByRole("searchbox", { name: "Search projects and sessions" });

describe("ProjectsWindowContent", () => {
  beforeEach(() => {
    localStorage.clear();
    inView.projectId = "project-1";
    given([CHURN, FORECAST]);
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [RESEARCH, OPERATIONS],
    } as unknown as ReturnType<typeof useWorkspaces>);
    vi.mocked(usePinnedProjects).mockReturnValue({
      projects: [],
      isPending: false,
    });
    vi.mocked(useDeleteProjectAction).mockReturnValue({
      confirmAndDelete: vi.fn(),
      isDeleting: false,
      confirmation: {},
    } as unknown as ReturnType<typeof useDeleteProjectAction>);
    vi.mocked(useSessionsOfProjects).mockReturnValue({
      sessionsByProject: new Map([[FORECAST.id, [BACKFILL]]]),
      isLoading: false,
    });
  });
  afterEach(() => vi.resetAllMocks());

  it("lists every project, opening only the one in view", () => {
    render(<ProjectsWindowContent />);

    expect(screen.getByText("Churn model")).toBeInTheDocument();
    expect(screen.getByText("Q3 forecasting")).toBeInTheDocument();
    expect(screen.getByTestId("sessions-project-1")).toBeInTheDocument();
    expect(screen.queryByTestId("sessions-project-2")).toBeNull();
  });

  /** A shared link opens a project that is neither created nor pinned. */
  it("still lists the project in view when it is not otherwise reachable", () => {
    given([FORECAST]);

    render(<ProjectsWindowContent />);

    expect(screen.getByText("Churn model")).toBeInTheDocument();
  });

  it("starts a new chat in the project in view", async () => {
    const user = userEvent.setup();
    render(<ProjectsWindowContent />);

    await user.click(screen.getByRole("button", { name: /New chat/ }));

    expect(startSession).toHaveBeenCalled();
    expect(openProject).not.toHaveBeenCalled();
  });

  /** A move to another project may still be loading, and would take the page there after. */
  it("cancels a move elsewhere when a new chat starts in the project in view", async () => {
    const user = userEvent.setup();
    render(<ProjectsWindowContent />);

    await user.click(screen.getByRole("button", { name: /New chat/ }));

    expect(cancelPendingProjectMove).toHaveBeenCalled();
  });

  it("starts a new chat in whichever project was clicked last", async () => {
    const user = userEvent.setup();
    render(<ProjectsWindowContent />);

    await user.click(screen.getByText("Q3 forecasting"));
    await user.click(screen.getByRole("button", { name: /New chat/ }));

    expect(startSession).not.toHaveBeenCalled();
    expect(openProject).toHaveBeenCalledWith("project-2", { session: "new" });
  });

  /** The sidebar stays mounted when a session click moves to another project. */
  it("starts a new chat in the project arrived in, not the one left", async () => {
    const user = userEvent.setup();
    render(<ProjectsWindowContent />);

    act(() => {
      inView.projectId = "project-2";
      inView.changed();
    });
    await user.click(screen.getByRole("button", { name: /New chat/ }));

    expect(startSession).toHaveBeenCalled();
    expect(openProject).not.toHaveBeenCalled();
    expect(screen.getByTestId("sessions-project-2")).toBeInTheDocument();
  });

  it("starts in the project in view once the one clicked last is deleted", async () => {
    const user = userEvent.setup();
    render(<ProjectsWindowContent />);

    await user.click(screen.getByText("Q3 forecasting"));
    given([CHURN]);
    act(() => inView.changed());
    await user.click(screen.getByRole("button", { name: /New chat/ }));

    expect(startSession).toHaveBeenCalled();
    expect(openProject).not.toHaveBeenCalled();
  });

  it("remembers which projects were left open", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ProjectsWindowContent />);

    await user.click(screen.getByText("Q3 forecasting"));
    unmount();
    render(<ProjectsWindowContent />);

    expect(screen.getByTestId("sessions-project-2")).toBeInTheDocument();
  });

  it("offers a menu for each project", () => {
    render(<ProjectsWindowContent />);

    expect(
      screen.getByRole("button", { name: "Project actions: Churn model" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Project actions: Q3 forecasting" }),
    ).toBeInTheDocument();
  });

  /** Deleting the project in view leaves nothing to show, so only it moves away. */
  it("leaves the page only when the project in view is deleted", () => {
    render(<ProjectsWindowContent />);

    expect(useDeleteProjectAction).toHaveBeenCalledWith(CHURN, {
      navigateAfterDelete: true,
    });
    expect(useDeleteProjectAction).toHaveBeenCalledWith(FORECAST, {
      navigateAfterDelete: false,
    });
  });

  it("keeps one unheaded list while nothing is pinned and every project shares a workspace", () => {
    render(<ProjectsWindowContent />);

    expect(screen.queryByText("Pinned")).toBeNull();
    expect(screen.queryByText("Research")).toBeNull();
    expect(screen.getAllByRole("list")).toHaveLength(1);
  });

  it("gathers pinned projects in their own section above the rest", () => {
    vi.mocked(usePinnedProjects).mockReturnValue({
      projects: [FORECAST] as ReturnType<typeof usePinnedProjects>["projects"],
      isPending: false,
    });

    render(<ProjectsWindowContent />);

    const pinned = screen.getByRole("list", { name: "Pinned" });
    const rest = screen.getByRole("list", { name: "Projects" });
    expect(pinned).toHaveTextContent("Q3 forecasting");
    expect(pinned).not.toHaveTextContent("Churn model");
    expect(rest).toHaveTextContent("Churn model");
    expect(
      pinned.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe("across workspaces", () => {
    beforeEach(() => given([CHURN, FORECAST, PRICING]));

    it("gathers the projects of each workspace under its name, by name", () => {
      render(<ProjectsWindowContent />);

      const operations = screen.getByRole("list", { name: "Operations" });
      const research = screen.getByRole("list", { name: "Research" });
      expect(operations).toHaveTextContent("Pricing experiments");
      expect(operations).not.toHaveTextContent("Churn model");
      expect(research).toHaveTextContent("Churn model");
      expect(research).toHaveTextContent("Q3 forecasting");
      expect(screen.queryByRole("list", { name: "Projects" })).toBeNull();
      expect(
        operations.compareDocumentPosition(research) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("keeps pinned projects in their own section ahead of the workspaces", () => {
      vi.mocked(usePinnedProjects).mockReturnValue({
        projects: [FORECAST] as ReturnType<
          typeof usePinnedProjects
        >["projects"],
        isPending: false,
      });

      render(<ProjectsWindowContent />);

      const pinned = screen.getByRole("list", { name: "Pinned" });
      const operations = screen.getByRole("list", { name: "Operations" });
      expect(pinned).toHaveTextContent("Q3 forecasting");
      expect(
        screen.getByRole("list", { name: "Research" }),
      ).not.toHaveTextContent("Q3 forecasting");
      expect(
        pinned.compareDocumentPosition(operations) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("closes a workspace out of the way and remembers it", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<ProjectsWindowContent />);

      await user.click(screen.getByRole("button", { name: "Research" }));
      expect(screen.queryByText("Churn model")).toBeNull();
      expect(screen.getByText("Pricing experiments")).toBeInTheDocument();

      unmount();
      render(<ProjectsWindowContent />);

      expect(screen.queryByText("Churn model")).toBeNull();
      expect(screen.getByRole("button", { name: "Research" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("shows a closed workspace's matches while searching, and closes it again after", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);
      await user.click(screen.getByRole("button", { name: "Research" }));

      await user.type(searchBox(), "churn");

      expect(screen.getByText("Churn model")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Operations" })).toBeNull();

      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(screen.queryByText("Churn model")).toBeNull();
    });

    it("forgets a workspace closed while searching", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "model");
      await user.click(screen.getByRole("button", { name: "Research" }));
      expect(screen.queryByText("Churn model")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(screen.getByText("Churn model")).toBeInTheDocument();
    });

    /** A shared link can open a project in a workspace the caller can't see. */
    it("lists a project of an unknown workspace under its own heading, last", () => {
      given([PRICING], { ...CHURN, workspaceId: "ws-elsewhere" });

      render(<ProjectsWindowContent />);

      const operations = screen.getByRole("list", { name: "Operations" });
      const other = screen.getByRole("list", { name: "Other workspace" });
      expect(other).toHaveTextContent("Churn model");
      expect(
        operations.compareDocumentPosition(other) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("keeps one list until the workspaces are known", () => {
      vi.mocked(useWorkspaces).mockReturnValue({
        data: undefined,
      } as unknown as ReturnType<typeof useWorkspaces>);

      render(<ProjectsWindowContent />);

      expect(screen.getAllByRole("list")).toHaveLength(1);
      expect(screen.getByText("Pricing experiments")).toBeInTheDocument();
    });
  });

  describe("searching", () => {
    it("lists only the projects whose name matches", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "forecast");

      expect(screen.getByText("Q3 forecasting")).toBeInTheDocument();
      expect(screen.queryByText("Churn model")).toBeNull();
    });

    it("opens a project to show the sessions that match", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "march");

      expect(screen.queryByText("Churn model")).toBeNull();
      expect(screen.getByTestId("sessions-project-2")).toHaveTextContent(
        "only s-3",
      );
    });

    it("says when nothing matches", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "retention");

      expect(
        screen.getByText("No matching projects or sessions"),
      ).toBeInTheDocument();
    });

    /** A session's title can match where no project's name does. */
    it("doesn't say nothing matches while sessions are still being read", async () => {
      vi.mocked(useSessionsOfProjects).mockReturnValue({
        sessionsByProject: new Map(),
        isLoading: true,
      });
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "march");

      expect(screen.getByText("Searching…")).toBeInTheDocument();
      expect(screen.queryByText("No matching projects or sessions")).toBeNull();
    });

    it("brings every project back when Escape clears it", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "forecast{Escape}");

      expect(searchBox()).toHaveValue("");
      expect(screen.getByText("Churn model")).toBeInTheDocument();
    });

    it("reads every project's sessions only while searching", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);
      expect(useSessionsOfProjects).toHaveBeenLastCalledWith(
        ["project-1", "project-2"],
        false,
      );

      await user.type(searchBox(), "m");

      expect(useSessionsOfProjects).toHaveBeenLastCalledWith(
        ["project-1", "project-2"],
        true,
      );
    });

    it("forgets what was opened while searching", async () => {
      const user = userEvent.setup();
      render(<ProjectsWindowContent />);

      await user.type(searchBox(), "forecast");
      await user.click(screen.getByText("Q3 forecasting"));
      expect(screen.getByTestId("sessions-project-2")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Clear search" }));

      expect(screen.queryByTestId("sessions-project-2")).toBeNull();
      expect(searchBox()).toHaveFocus();
    });
  });
});

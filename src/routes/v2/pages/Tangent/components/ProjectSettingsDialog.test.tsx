import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProject } from "@/services/projects/useProjects";

import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({
    projectId: "project-1",
    activeSessionId: "session-1",
  }),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/services/projects/useProjectInstructions", () => ({
  useProjectInstructions: () => ({
    instructions: "Reply in haiku",
    isPending: false,
    isSaving: false,
    save: vi.fn(),
  }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectHasSecrets", () => ({
  useProjectHasSecrets: () => false,
}));

vi.mock("@/components/Project/ProjectWorkspaceLabel", () => ({
  ProjectWorkspaceLabel: () => <span>Local development</span>,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: ReactNode;
    to: string;
    params: { projectId: string };
  }) => (
    <a href={to.replace("$projectId", params.projectId)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/Project/PinProjectButton", () => ({
  PinProjectButton: ({ project }: { project: { name: string } }) => (
    <button type="button">Pin {project.name}</button>
  ),
}));

vi.mock("./LocalEnvIndicator", () => ({ LocalEnvIndicator: () => null }));
vi.mock("./AttachAgentButton", () => ({ AttachAgentButton: () => null }));
vi.mock("./AgentTraceDialog", () => ({ AgentTraceDialog: () => null }));
vi.mock("./SecretsWindowContent", () => ({ SecretsWindowContent: () => null }));

function projectLoaded() {
  vi.mocked(useProject).mockReturnValue({
    data: {
      id: "project-1",
      name: "Hello world website",
      description: "A small site to try agents on",
      createdBy: "alice@example.com",
      createdAt: new Date("2026-11-03T13:12:00Z"),
      updatedAt: new Date("2026-11-03T13:39:00Z"),
    },
  } as unknown as ReturnType<typeof useProject>);
}

function renderSettings() {
  return render(<ProjectSettingsDialog open onOpenChange={vi.fn()} />);
}

describe("ProjectSettingsDialog", () => {
  afterEach(() => vi.resetAllMocks());

  /** With several projects a click apart, the dialog says whose settings these are. */
  it("names the project and its workspace", () => {
    projectLoaded();
    renderSettings();

    const dialog = screen.getByRole("dialog", { name: "Project settings" });
    expect(dialog).toHaveAccessibleDescription("Hello world website");
    expect(screen.getByText("Local development")).toBeInTheDocument();
  });

  it("describes itself until the project has loaded", () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useProject>);

    renderSettings();

    expect(
      screen.getByText("Connections and tools for this project's agents."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Description")).toBeNull();
  });

  it("links to the project's own page", () => {
    projectLoaded();
    renderSettings();

    expect(
      screen.getByRole("link", { name: "Hello world website" }),
    ).toHaveAttribute("href", "/projects/project-1");
  });

  /** Pinning is the only thing that keeps a shared project reachable. */
  it("offers to pin the project", () => {
    projectLoaded();
    renderSettings();

    expect(
      screen.getByRole("button", { name: "Pin Hello world website" }),
    ).toBeInTheDocument();
  });

  it("edits what the project is for and what its agents are told", () => {
    projectLoaded();
    renderSettings();

    expect(screen.getByLabelText("Description")).toHaveValue(
      "A small site to try agents on",
    );
    expect(screen.getByLabelText("Instructions for agents")).toHaveValue(
      "Reply in haiku",
    );
  });

  it("says who made the project", () => {
    projectLoaded();
    renderSettings();

    expect(
      screen.getByText(/Created by alice@example\.com/),
    ).toBeInTheDocument();
  });

  it("sets the agents' instructions apart from what the project connects to", () => {
    projectLoaded();
    renderSettings();

    expect(
      screen.getByRole("textbox", { name: "Instructions for agents" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Connections" }),
    ).toBeInTheDocument();
  });

  /** Focus on the first control would ring the pin button before anyone acts. */
  it("opens with focus on the dialog, not on its first control", () => {
    projectLoaded();
    renderSettings();

    expect(screen.getByRole("dialog")).toHaveFocus();
  });
});

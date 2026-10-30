import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProjectLocalEnv } from "@/routes/v2/pages/Tangent/hooks/useProjectLocalEnv";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { API_URL } from "@/utils/constants";

import { LocalEnvIndicator } from "./LocalEnvIndicator";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({
    projectId: "project-1",
    activeSessionId: "session-1",
  }),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: () => ({ data: { name: "My Project" } }),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessions", () => ({
  useProjectSessions: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectLocalEnv", () => ({
  useProjectLocalEnv: vi.fn(),
}));

const SHELL_URL = "http://localhost:9005";

function mockBaseUrl(baseUrl: string | null) {
  vi.mocked(useTangentBaseUrl).mockReturnValue({
    baseUrl,
    localAddress: null,
    isLoading: false,
    isError: false,
  });
  vi.mocked(useProjectSessions).mockReturnValue({
    sessions: [
      {
        resourceId: "resource-1",
        sessionId: "session-1",
        name: null,
        createdAt: new Date(),
      },
    ],
    isLoading: false,
    isAttaching: false,
    attachSession: vi.fn(),
    detachSession: vi.fn(),
    renameSession: vi.fn(),
  });
}

type EnvironmentSpec = {
  environmentId: string;
  metadata?: Record<string, string>;
};

function mockLocalEnvironments(environments: Array<string | EnvironmentSpec>) {
  const localEnvironments = environments.map((environment) => {
    const spec =
      typeof environment === "string"
        ? { environmentId: environment }
        : environment;
    return {
      scoped: false,
      toolCount: 7,
      subagentCount: 0,
      ...spec,
    };
  });
  vi.mocked(useProjectLocalEnv).mockReturnValue({
    localEnvironments,
    isLocalEnvConnected: localEnvironments.length > 0,
  });
}

describe("LocalEnvIndicator", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("offers to connect an editor when no local environment is connected", () => {
    mockBaseUrl(SHELL_URL);
    mockLocalEnvironments([]);

    render(<LocalEnvIndicator />);

    expect(
      screen.getByRole("button", { name: "Connect VS Code" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Local environment connected")).toBeNull();
  });

  it("shows the connected window name on the badge", () => {
    mockBaseUrl(SHELL_URL);
    mockLocalEnvironments([
      {
        environmentId: "session-1:vscode-abc",
        metadata: { windowName: "my-workspace" },
      },
    ]);

    render(<LocalEnvIndicator />);

    expect(
      screen.getByRole("button", { name: "Local environment connected" }),
    ).toHaveTextContent("Local env · my-workspace");
  });

  it("falls back to the host id when no window name is advertised", () => {
    mockBaseUrl(SHELL_URL);
    mockLocalEnvironments(["session-1:vscode-abc"]);

    render(<LocalEnvIndicator />);

    expect(
      screen.getByRole("button", { name: "Local environment connected" }),
    ).toHaveTextContent("Local env · vscode-abc");
  });

  it("reveals host details in a popover", async () => {
    const user = userEvent.setup();
    mockBaseUrl(SHELL_URL);
    mockLocalEnvironments([
      {
        environmentId: "session-1:vscode-abc",
        metadata: {
          windowName: "my-workspace",
          workspacePath: "/home/me/proj",
          editor: "Cursor",
        },
      },
    ]);

    render(<LocalEnvIndicator />);
    await user.click(
      screen.getByRole("button", { name: "Local environment connected" }),
    );

    expect(await screen.findByText("/home/me/proj")).toBeInTheDocument();
    expect(screen.getByText("Cursor")).toBeInTheDocument();
  });

  it("summarizes the count when several windows are connected", () => {
    mockBaseUrl(SHELL_URL);
    mockLocalEnvironments([
      {
        environmentId: "session-1:vscode-abc",
        metadata: { windowName: "first" },
      },
      {
        environmentId: "session-1:vscode-def",
        metadata: { windowName: "second" },
      },
    ]);

    render(<LocalEnvIndicator />);

    expect(
      screen.getByRole("button", { name: "Local environment connected" }),
    ).toHaveTextContent("Local env (2)");
  });

  it("links to the extension's connect flow for VS Code and Cursor", async () => {
    const user = userEvent.setup();
    mockBaseUrl(SHELL_URL);
    mockLocalEnvironments([]);

    render(<LocalEnvIndicator />);
    await user.click(screen.getByRole("button", { name: "Connect VS Code" }));

    const apiUrl = encodeURIComponent(API_URL || window.location.origin);
    const vscodeLink = await screen.findByRole("link", {
      name: "Connect in VS Code",
    });
    expect(vscodeLink).toHaveAttribute(
      "href",
      `vscode://tangent.tangent-local-agent/connect?url=http%3A%2F%2Flocalhost%3A9005&apiUrl=${apiUrl}&projectId=project-1&projectName=My+Project`,
    );

    await user.click(screen.getByRole("button", { name: "More editors" }));

    const cursorLink = await screen.findByRole("menuitem", {
      name: "Connect in Cursor",
    });
    expect(cursorLink).toHaveAttribute(
      "href",
      `cursor://tangent.tangent-local-agent/connect?url=http%3A%2F%2Flocalhost%3A9005&apiUrl=${apiUrl}&projectId=project-1&projectName=My+Project`,
    );
  });

  it("renders nothing until Tangent's location is known", () => {
    mockBaseUrl(null);
    mockLocalEnvironments([]);

    const { container } = render(<LocalEnvIndicator />);

    expect(container).toBeEmptyDOMElement();
  });
});

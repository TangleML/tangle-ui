import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Workspace } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

import { WorkspaceNotice } from "./WorkspaceNotice";

vi.mock("@/services/projects/useWorkspaces", () => ({
  useWorkspaces: vi.fn(),
}));

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: "ws-1",
  name: "Research",
  description: null,
  isActive: true,
  metadata: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

function mockWorkspaces(
  data: Workspace[] | undefined,
  error: Error | null = null,
) {
  vi.mocked(useWorkspaces).mockReturnValue({
    data,
    error,
  } as unknown as ReturnType<typeof useWorkspaces>);
}

describe("WorkspaceNotice", () => {
  afterEach(() => vi.resetAllMocks());

  it("says nothing while the workspaces are on their way", () => {
    mockWorkspaces(undefined);

    const { container } = render(<WorkspaceNotice />);

    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing when there is a workspace to create in", () => {
    mockWorkspaces([workspace()]);

    const { container } = render(<WorkspaceNotice />);

    expect(container).toBeEmptyDOMElement();
  });

  it("points at an admin when no workspace takes new projects", () => {
    mockWorkspaces([workspace({ isActive: false })]);

    render(<WorkspaceNotice />);

    expect(
      screen.getByText(
        "Projects cannot be created yet. Contact your Tangle Admin for help.",
      ),
    ).toBeVisible();
  });

  it("says why the workspaces could not be loaded", () => {
    mockWorkspaces(undefined, new Error("Gateway timeout"));

    render(<WorkspaceNotice />);

    expect(
      screen.getByText(
        "Could not load workspaces, so a project cannot be created: Gateway timeout",
      ),
    ).toBeVisible();
  });
});

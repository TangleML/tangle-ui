import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRun } from "@/services/projects/types";
import { useProjectRuns } from "@/services/projects/useProjectRuns";
import { formatDate } from "@/utils/date";

import { ProjectRuns } from "./ProjectRuns";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: vi.fn(),
}));

vi.mock("@/routes/runRoutes", () => ({
  getDefaultRunPath: (id: string) => `/runs/${id}`,
}));

vi.mock("./ProjectRunStatus", () => ({
  ProjectRunStatus: ({ runId }: { runId: string }) => (
    <span data-testid={`status-${runId}`} />
  ),
}));

function makeRun(overrides: Partial<ProjectRun> = {}): ProjectRun {
  return {
    id: "run-1",
    rootExecutionId: "exec-1",
    pipelineName: "Hello World",
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-16T18:24:57Z"),
    ...overrides,
  };
}

function mockRuns(
  items: ProjectRun[],
  overrides: Record<string, unknown> = {},
) {
  vi.mocked(useProjectRuns).mockReturnValue({
    data: { items, nextPageToken: null },
    isPending: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProjectRuns>);
}

const renderRuns = () => render(<ProjectRuns projectId="project-1" />);

describe("ProjectRuns", () => {
  beforeEach(() => {
    mockRuns([makeRun()]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("lists what has been run in the project", () => {
    renderRuns();

    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(
      screen.getByText(formatDate(new Date("2026-09-16T18:24:57Z"))),
    ).toBeInTheDocument();
  });

  it("leaves out who started a run, which the project already implies", () => {
    renderRuns();

    expect(screen.queryByText("alice@example.com")).toBeNull();
  });

  it("heads each column it shows", () => {
    renderRuns();

    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Pipeline", "Status", "Started"]);
  });

  it("shows each run's overall status", () => {
    mockRuns([makeRun({ id: "a" }), makeRun({ id: "b" })]);
    renderRuns();

    expect(screen.getByTestId("status-a")).toBeInTheDocument();
    expect(screen.getByTestId("status-b")).toBeInTheDocument();
  });

  it("counts the runs in its heading", () => {
    mockRuns([makeRun({ id: "a" }), makeRun({ id: "b" })]);
    renderRuns();

    expect(
      screen.getByRole("heading", { name: "Runs (2)" }),
    ).toBeInTheDocument();
  });

  it("opens a run where the rest of the app opens runs", () => {
    renderRuns();

    expect(screen.getByRole("link", { name: "Hello World" })).toHaveAttribute(
      "href",
      "/runs/run-1",
    );
  });

  it("still opens a run whose pipeline has no name", () => {
    mockRuns([makeRun({ pipelineName: null })]);
    renderRuns();

    expect(
      screen.getByRole("link", { name: "Unnamed pipeline" }),
    ).toHaveAttribute("href", "/runs/run-1");
  });

  it("says when nothing has been run", () => {
    mockRuns([]);
    renderRuns();

    expect(
      screen.getByText("Nothing in this project has been run yet"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
  });

  it("waits on the runs rather than claiming there are none", () => {
    mockRuns([], { data: undefined, isPending: true });
    renderRuns();

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    expect(
      screen.queryByText("Nothing in this project has been run yet"),
    ).toBeNull();
  });

  it("reports a failure to load the runs", () => {
    mockRuns([], {
      data: undefined,
      isPending: false,
      error: new Error("runs exploded"),
    });
    renderRuns();

    expect(screen.getByText("Error loading runs")).toBeInTheDocument();
    expect(screen.getByText("runs exploded")).toBeInTheDocument();
  });

  it("admits when it has only listed the most recent runs", () => {
    mockRuns([makeRun()], {
      data: { items: [makeRun()], nextPageToken: "token-2" },
    });
    renderRuns();

    expect(
      screen.getByText("Showing the 1 most recent runs."),
    ).toBeInTheDocument();
  });
});

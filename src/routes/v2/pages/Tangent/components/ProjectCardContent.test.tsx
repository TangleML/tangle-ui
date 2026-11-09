import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCardContent } from "./ProjectCardContent";

const place = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({
    projectId: "project-1",
    openWorkareaTarget: vi.fn(),
    openArtifactTab: vi.fn(),
  }),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/utils/date", () => ({
  formatRelativeTime: (date: Date) => `on ${date.toISOString().slice(5, 10)}`,
}));

vi.mock("./AddResourceButton", () => ({
  AddResourceButton: ({ kind }: { kind: string }) => (
    <button type="button">Add {kind}</button>
  ),
}));

const pipeline = (n: number) => ({
  id: `p-${n}`,
  name: `Pipeline ${n}`,
  icon: "GitBranch",
  description: "Pipeline",
  target: { type: "pipeline", identity: `id/p-${n}` },
});

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectResourceItems", () => ({
  useProjectResourceItems: () => ({
    summaries: [],
    resources: [
      pipeline(1),
      pipeline(2),
      pipeline(3),
      pipeline(4),
      {
        id: "d-1",
        name: "Project brief",
        icon: "FileText",
        description: "Document",
        target: { type: "document", identity: "id/d-1" },
      },
    ],
  }),
}));

vi.mock("@/services/projects/useProjectRuns", () => ({
  useProjectRuns: () => ({
    data: [
      {
        id: "run-1",
        rootExecutionId: "e-1",
        pipelineName: "Pipeline 1",
        createdBy: null,
        createdAt: new Date("2026-11-05"),
      },
      {
        id: "run-2",
        rootExecutionId: "e-2",
        pipelineName: "Somewhere else",
        createdBy: null,
        createdAt: new Date("2026-11-04"),
      },
    ],
    hasNextPage: false,
  }),
  useRunExecutionStats: () => ({ data: undefined, isPending: true }),
}));

const file = (key: string, title: string, placement: string) => ({
  key,
  sessionId: "s-1",
  path: `artifacts/${key}`,
  title,
  addedAt: new Date("2026-11-06"),
  url: `https://tangent.example/files/${key}`,
  placement,
});

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessionFiles", () => ({
  useProjectSessionFiles: () => ({
    reports: [file("summary.html", "Q3 summary", "report")],
    workingFiles: [
      file("plan.md", "Plan", "working"),
      file("notes.md", "Notes", "working"),
    ],
    isLoading: false,
    place,
  }),
}));

const sectionNames = () =>
  screen
    .getAllByRole("region")
    .map((region) => region.getAttribute("aria-label"));

async function search(text: string) {
  const user = userEvent.setup();
  render(<ProjectCardContent />);
  await user.type(
    screen.getByRole("searchbox", { name: "Search this project" }),
    text,
  );
  return user;
}

describe("ProjectCardContent", () => {
  beforeEach(() => localStorage.clear());

  it("leads with reports, then runs, pipelines and documents, with working files folded away", () => {
    render(<ProjectCardContent />);

    expect(sectionNames()).toEqual([
      "Reports",
      "Runs",
      "Pipelines",
      "Documents",
      "Working files",
    ]);
    expect(screen.getByText("Q3 summary")).toBeInTheDocument();
    expect(screen.getByText("Project brief")).toBeInTheDocument();
    expect(screen.queryByText("Plan")).toBeNull();
  });

  it("lists every item in a section rather than hiding some behind Show all", () => {
    render(<ProjectCardContent />);

    const pipelines = screen.getByRole("region", { name: "Pipelines" });
    expect(within(pipelines).getByText("Pipeline 4")).toBeInTheDocument();
    expect(screen.queryByText(/Show all/)).toBeNull();
  });

  it("lists runs newest first, whichever pipeline they ran", () => {
    render(<ProjectCardContent />);

    const runs = screen.getByRole("region", { name: "Runs" });
    const rows = within(runs)
      .getAllByRole("listitem")
      .map((row) => row.textContent);
    expect(rows[0]).toContain("Pipeline 1");
    expect(rows[0]).toContain("on 11-05");
    expect(rows[1]).toContain("Somewhere else");
  });

  it("filters every section by one search, dropping those with no match", async () => {
    await search("pipeline 4");

    expect(sectionNames()).toEqual(["Pipelines"]);
    expect(screen.getByText("Pipeline 4")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline 1")).toBeNull();
  });

  it("finds working files without unfolding them first", async () => {
    await search("plan");

    expect(sectionNames()).toEqual(["Working files"]);
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    await search("retention");

    expect(
      screen.getByText("Nothing in this project matches"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
  });

  it("unfolds working files and moves one to reports", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(screen.getByRole("button", { name: /Working files/ }));
    await user.click(
      screen.getAllByRole("button", { name: "Move to reports" })[0],
    );

    expect(place).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Plan" }),
      "report",
    );
  });

  it("archives an item out of its section and keeps it behind Show archived", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(
      screen.getByRole("button", { name: "Archive Project brief" }),
    );

    expect(screen.queryByText("Project brief")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Show archived/ }));

    const documents = screen.getByRole("region", { name: "Documents" });
    expect(within(documents).getByText("Project brief")).toBeInTheDocument();
    expect(sectionNames()).toEqual(["Documents"]);
  });

  it("restores an archived item to its section", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(
      screen.getByRole("button", { name: "Archive Q3 summary" }),
    );
    await user.click(screen.getByRole("button", { name: /Show archived/ }));
    await user.click(
      screen.getByRole("button", { name: "Restore Q3 summary" }),
    );

    expect(screen.getByText("Nothing is archived")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      within(screen.getByRole("region", { name: "Reports" })).getByText(
        "Q3 summary",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show archived/ })).toBeNull();
  });
});

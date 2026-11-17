import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectCardContent } from "./ProjectCardContent";

const pin = vi.fn();
const unpin = vi.fn();
const archiveChange = vi.fn();

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

vi.mock("@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems", async () => {
  const { useState } = await import("react");
  return {
    useArchivedProjectItems: () => {
      const [archived, setArchived] = useState<string[]>([]);
      const change = (target: string, archive: boolean) => {
        archiveChange(target, archive);
        setArchived((current) =>
          archive
            ? [...current, target]
            : current.filter((item) => item !== target),
        );
      };
      return {
        isArchived: (target: string) => archived.includes(target),
        archive: (target: string) => change(target, true),
        restore: (target: string) => change(target, false),
      };
    },
  };
});

vi.mock("./AddResourceButton", () => ({
  AddResourceButton: ({
    kind,
    disabled,
  }: {
    kind: string;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled}>
      Add {kind}
    </button>
  ),
}));

const loading = vi.hoisted(() => ({
  resources: { isLoading: false, isLoaded: true, error: null as Error | null },
  runs: { isLoading: false, error: null as Error | null },
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
    ...loading.resources,
    summaries: [],
    resources: !loading.resources.isLoaded
      ? []
      : [
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
    ...loading.runs,
    data:
      loading.runs.isLoading || loading.runs.error
        ? undefined
        : [
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

const file = (key: string, title: string, pinned: boolean) => ({
  key,
  sessionId: "s-1",
  path: `artifacts/${key}`,
  title,
  addedAt: new Date("2026-11-06"),
  url: `https://tangent.example/files/${key}`,
  pinned,
});

vi.mock("@/routes/v2/pages/Tangent/hooks/useProjectSessionFiles", () => ({
  useProjectSessionFiles: () => {
    const summary = file("summary.html", "Q3 summary", true);
    return {
      files: [
        summary,
        file("plan.md", "Plan", false),
        file("notes.md", "Notes", false),
      ],
      reports: [summary],
      isLoading: false,
      pin,
      unpin,
    };
  },
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
  beforeEach(() => {
    pin.mockClear();
    unpin.mockClear();
    archiveChange.mockClear();
    loading.resources = { isLoading: false, isLoaded: true, error: null };
    loading.runs = { isLoading: false, error: null };
  });

  it("says a section is loading rather than that the project has none", () => {
    loading.resources = { isLoading: true, isLoaded: false, error: null };
    loading.runs = { isLoading: true, error: null };
    render(<ProjectCardContent />);

    for (const name of ["Runs", "Pipelines", "Documents"]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getByText("Loading…")).toBeInTheDocument();
    }
    expect(screen.queryByText("No pipelines yet")).toBeNull();
  });

  it("says when a section couldn't load", () => {
    loading.resources = {
      isLoading: false,
      isLoaded: false,
      error: new Error("500"),
    };
    loading.runs = { isLoading: false, error: new Error("500") };
    render(<ProjectCardContent />);

    expect(
      screen.getByText("Couldn't load this project's runs"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Couldn't load this project's pipelines"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Couldn't load this project's documents"),
    ).toBeInTheDocument();
  });

  it("lets nothing be added until the project's resources have loaded", () => {
    loading.resources = { isLoading: true, isLoaded: false, error: null };
    render(<ProjectCardContent />);

    expect(screen.getByRole("button", { name: "Add pipeline" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add run" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add document" })).toBeDisabled();
  });

  it("leads with reports, then runs, pipelines and documents, with other files behind All files", () => {
    render(<ProjectCardContent />);

    expect(sectionNames()).toEqual([
      "Reports",
      "Runs",
      "Pipelines",
      "Documents",
    ]);
    expect(screen.getByText("Q3 summary")).toBeInTheDocument();
    expect(screen.getByText("Project brief")).toBeInTheDocument();
    expect(screen.queryByText("Plan")).toBeNull();
    expect(screen.getByRole("button", { name: /All files/ })).toHaveTextContent(
      "3",
    );
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

  it("finds files that aren't reports while searching", async () => {
    await search("plan");

    expect(sectionNames()).toEqual(["Other files"]);
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    await search("retention");

    expect(
      screen.getByText("Nothing in this project matches"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
  });

  it("lists every file under All files, pinned ones marked, and pins one to the reports", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(screen.getByRole("button", { name: /All files/ }));
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Q3 summary")).toBeInTheDocument();
    expect(screen.getByText("Pinned to reports")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Pin Plan to reports" }),
    );

    expect(pin).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Plan" }),
    );
  });

  it("searches All files on its own", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(screen.getByRole("button", { name: /All files/ }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search all files" }),
      "notes",
    );

    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.queryByText("Plan")).toBeNull();

    await user.type(
      screen.getByRole("searchbox", { name: "Search all files" }),
      "zzz",
    );
    expect(screen.getByText("No files match")).toBeInTheDocument();
  });

  it("unpins a report", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(
      screen.getByRole("button", { name: "Unpin Q3 summary from reports" }),
    );

    expect(unpin).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Q3 summary" }),
    );
  });

  it("archives an item out of its section and keeps it behind Show archived", async () => {
    const user = userEvent.setup();
    render(<ProjectCardContent />);

    await user.click(
      screen.getByRole("button", { name: "Archive Project brief" }),
    );

    expect(archiveChange).toHaveBeenCalledWith("document://id/d-1", true);
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
      screen.getByRole("button", { name: "Archive Project brief" }),
    );
    await user.click(screen.getByRole("button", { name: /Show archived/ }));
    await user.click(
      screen.getByRole("button", { name: "Restore Project brief" }),
    );

    expect(screen.getByText("Nothing is archived")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      within(screen.getByRole("region", { name: "Documents" })).getByText(
        "Project brief",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show archived/ })).toBeNull();
  });
});

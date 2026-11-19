import { describe, expect, it } from "vitest";

import type {
  ProjectResourceSummary,
  ProjectRun,
} from "@/services/projects/types";

import { mergeProjectRuns, projectCardLists } from "./projectCardEntries";

function run(id: string, pipelineName: string | null, day: number): ProjectRun {
  return {
    id,
    rootExecutionId: `exec-${id}`,
    pipelineName,
    createdBy: null,
    createdAt: new Date(`2026-11-0${day}`),
  };
}

describe("mergeProjectRuns", () => {
  it("lists started and attached runs together, newest first", () => {
    const runs = mergeProjectRuns(
      [run("r-1", "Churn model", 1), run("r-3", "Forecast", 3)],
      [
        {
          id: "r-2",
          pipelineName: "Hello World",
          ranAt: new Date("2026-11-02"),
        },
      ],
    );

    expect(runs.map(({ id }) => id)).toEqual(["r-3", "r-2", "r-1"]);
  });

  it("lists a run that was started here and attached only once", () => {
    const runs = mergeProjectRuns(
      [run("r-1", "Churn model", 1)],
      [{ id: "r-1", pipelineName: "Churn model", ranAt: null }],
    );

    expect(runs).toHaveLength(1);
  });

  it("names a run without a pipeline name as an unnamed pipeline", () => {
    expect(mergeProjectRuns([run("r-1", null, 1)], [])[0].pipelineName).toBe(
      "Unnamed pipeline",
    );
  });
});

function summary(id: string, day: number): ProjectResourceSummary {
  const at = new Date(`2026-11-0${day}`);
  return {
    id,
    projectId: "p-1",
    entity: "document",
    name: id,
    entityId: null,
    metadata: null,
    createdBy: null,
    createdAt: at,
    updatedAt: at,
  };
}

describe("projectCardLists", () => {
  it("lists runs, pipelines and documents newest first, marking what's archived", () => {
    const lists = projectCardLists({
      items: [
        {
          id: "doc-old",
          name: "Old notes",
          icon: "FileText",
          description: "Document",
          target: { type: "document", identity: "id/doc-old" },
        },
        {
          id: "doc-new",
          name: "New notes",
          icon: "FileText",
          description: "Document",
          target: { type: "document", identity: "id/doc-new" },
        },
        {
          id: "pipe",
          name: "Churn model",
          icon: "GitBranch",
          description: "Pipeline — not in this browser",
        },
        {
          id: "attached-run",
          name: "Hello World",
          icon: "Play",
          description: "Run",
          target: { type: "run", identity: "id/r-2" },
        },
      ],
      summaries: [
        summary("doc-old", 1),
        summary("doc-new", 3),
        summary("attached-run", 2),
      ],
      projectRuns: [run("r-1", "Forecast", 1)],
      archived: new Set(["document://id/doc-old", "run://id/r-1"]),
    });

    expect(lists.documents.map(({ id, archived }) => [id, archived])).toEqual([
      ["doc-new", false],
      ["doc-old", true],
    ]);
    expect(lists.pipelines).toEqual([]);
    expect(lists.runs.map(({ id, archived }) => [id, archived])).toEqual([
      ["r-2", false],
      ["r-1", true],
    ]);
  });

  it("lists linked repositories newest first, keyed by their row for archiving", () => {
    const repository = (id: string, url: string | undefined) => ({
      id,
      name: id,
      icon: "FolderGit2" as const,
      description: "Repository",
      repository: { url },
    });
    const lists = projectCardLists({
      items: [
        repository("repo-old", "https://github.com/TangleML/old"),
        repository("repo-new", undefined),
      ],
      summaries: [summary("repo-old", 1), summary("repo-new", 2)],
      projectRuns: [],
      archived: new Set(["repository://id/repo-old"]),
    });

    expect(
      lists.repositories.map(({ id, key, archived, repository }) => [
        id,
        key,
        archived,
        repository.url,
      ]),
    ).toEqual([
      ["repo-new", "repository://id/repo-new", false, undefined],
      [
        "repo-old",
        "repository://id/repo-old",
        true,
        "https://github.com/TangleML/old",
      ],
    ]);
    expect(lists.documents).toEqual([]);
  });
});

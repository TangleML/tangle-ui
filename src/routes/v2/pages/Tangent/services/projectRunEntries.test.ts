import { describe, expect, it } from "vitest";

import type { ProjectRun } from "@/services/projects/types";

import { mergeProjectRuns } from "./projectRunEntries";

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

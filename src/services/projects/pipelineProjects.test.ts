import { describe, expect, it } from "vitest";

import { pipelineResourceIn } from "./pipelineProjects";
import type { ProjectResourceSummary } from "./types";

function row(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "pipeline",
    name: "Churn model",
    entityId: "pipeline-1",
    metadata: null,
    createdBy: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe("pipelineResourceIn", () => {
  it("finds the remote ID after the pipeline is renamed", () => {
    const wanted = row({ name: "Renamed" });
    expect(
      pipelineResourceIn([row({ entity: "document" }), wanted], "pipeline-1"),
    ).toBe(wanted);
  });

  it("distinguishes pipelines that share a name", () => {
    expect(pipelineResourceIn([row()], "pipeline-2")).toBeUndefined();
  });

  it("does not match another resource entity or an empty project", () => {
    expect(
      pipelineResourceIn([row({ entity: "document" })], "pipeline-1"),
    ).toBeUndefined();
    expect(pipelineResourceIn([], "pipeline-1")).toBeUndefined();
  });
});

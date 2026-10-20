import { afterEach, describe, expect, it, vi } from "vitest";

import { attachPipelineRunOnce } from "./attachPipelineRun";
import {
  createProjectResource,
  listProjectResources,
} from "./projectResourcesService";
import type { ProjectResourcePage, ProjectResourceSummary } from "./types";

vi.mock("./projectResourcesService", () => ({
  createProjectResource: vi.fn(),
  listProjectResources: vi.fn(),
}));

const runResource = (identity: string): ProjectResourceSummary => ({
  id: `resource-${identity}`,
  projectId: "project-1",
  entity: "document",
  name: "Churn",
  entityId: null,
  metadata: { type: "pipeline_run", identity },
  createdBy: null,
  createdAt: new Date("2026-09-09T10:00:00Z"),
  updatedAt: new Date("2026-09-09T10:00:00Z"),
});

const page = (
  identities: string[],
  nextPageToken: string | null = null,
): ProjectResourcePage => ({
  items: identities.map(runResource),
  nextPageToken,
  totalCount: identities.length,
});

const churnRun = { runId: "run-7", pipelineName: "Churn" };

describe("attachPipelineRunOnce", () => {
  afterEach(() => vi.resetAllMocks());

  it("attaches a run the project does not hold", async () => {
    vi.mocked(listProjectResources).mockResolvedValue(page(["run://id/run-1"]));

    await attachPipelineRunOnce("project-1", churnRun);

    expect(createProjectResource).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({
        name: "Churn",
        metadata: { type: "pipeline_run", identity: "run://id/run-7" },
      }),
    );
  });

  it("leaves a run the project already holds alone", async () => {
    vi.mocked(listProjectResources).mockResolvedValue(page(["run://id/run-7"]));

    await attachPipelineRunOnce("project-1", churnRun);

    expect(createProjectResource).not.toHaveBeenCalled();
  });

  it("looks past the first page", async () => {
    vi.mocked(listProjectResources)
      .mockResolvedValueOnce(page(["run://id/run-1"], "page-2"))
      .mockResolvedValueOnce(page(["run://id/run-7"]));

    await attachPipelineRunOnce("project-1", churnRun);

    expect(listProjectResources).toHaveBeenLastCalledWith(
      "project-1",
      expect.objectContaining({ pageToken: "page-2" }),
    );
    expect(createProjectResource).not.toHaveBeenCalled();
  });
});

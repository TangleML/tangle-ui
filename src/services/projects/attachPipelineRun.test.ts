import { afterEach, describe, expect, it, vi } from "vitest";

import { attachPipelineRunOnce } from "./attachPipelineRun";
import {
  createProjectResource,
  listProjectResources,
} from "./projectResourcesService";
import type { ProjectResourcePage } from "./types";

vi.mock("./projectResourcesService", () => ({
  createProjectResource: vi.fn(),
  listProjectResources: vi.fn(),
}));

function page(
  identities: string[],
  nextPageToken: string | null = null,
): ProjectResourcePage {
  return {
    items: identities.map((identity) => ({
      metadata: { type: "pipeline_run", identity },
    })),
    nextPageToken,
    totalCount: identities.length,
  } as unknown as ProjectResourcePage;
}

describe("attachPipelineRunOnce", () => {
  afterEach(() => vi.resetAllMocks());

  it("attaches a run the project does not hold", async () => {
    vi.mocked(listProjectResources).mockResolvedValue(page(["run://id/run-1"]));

    await attachPipelineRunOnce("project-1", "run-7", "Churn");

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

    await attachPipelineRunOnce("project-1", "run-7", "Churn");

    expect(createProjectResource).not.toHaveBeenCalled();
  });

  it("looks past the first page", async () => {
    vi.mocked(listProjectResources)
      .mockResolvedValueOnce(page(["run://id/run-1"], "page-2"))
      .mockResolvedValueOnce(page(["run://id/run-7"]));

    await attachPipelineRunOnce("project-1", "run-7", "Churn");

    expect(listProjectResources).toHaveBeenLastCalledWith(
      "project-1",
      expect.objectContaining({ pageToken: "page-2" }),
    );
    expect(createProjectResource).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveWorkareaTarget } from "./openWorkareaTarget";

const mocks = vi.hoisted(() => ({
  fetchPipelineRun: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/services/executionService", () => ({
  fetchPipelineRun: mocks.fetchPipelineRun,
}));

vi.mock("@/services/pipelineStorage/pipelineRegistry", () => ({
  findById: mocks.findById,
}));

const options = { backendUrl: "http://backend" };

describe("resolveWorkareaTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a pipeline:// URI to a pipeline view", async () => {
    mocks.findById.mockResolvedValue({ storageKey: "My Pipeline" });

    const view = await resolveWorkareaTarget("pipeline://abc", options);

    expect(view).toEqual({
      kind: "pipeline",
      title: "My Pipeline",
      pipelineRef: { name: "My Pipeline", fileId: "abc" },
    });
    expect(mocks.fetchPipelineRun).not.toHaveBeenCalled();
  });

  it("resolves a v2 run URL to a run view titled by the pipeline name", async () => {
    mocks.fetchPipelineRun.mockResolvedValue({ pipeline_name: "Nightly" });

    const view = await resolveWorkareaTarget(
      "https://host/runs-v2/123",
      options,
    );

    expect(view).toEqual({ kind: "run", title: "Nightly", runId: "123" });
    expect(mocks.fetchPipelineRun).toHaveBeenCalledWith(
      "123",
      "http://backend",
    );
  });

  it("resolves a v1 run URL to a run view", async () => {
    mocks.fetchPipelineRun.mockResolvedValue({ pipeline_name: "Nightly" });

    const view = await resolveWorkareaTarget("https://host/runs/123", options);

    expect(view).toEqual({ kind: "run", title: "Nightly", runId: "123" });
  });

  it("resolves a run URL with a subgraph segment to the run id", async () => {
    mocks.fetchPipelineRun.mockResolvedValue({ pipeline_name: "Nightly" });

    const view = await resolveWorkareaTarget(
      "https://host/runs-v2/123/exec-sub",
      options,
    );

    expect(view).toEqual({ kind: "run", title: "Nightly", runId: "123" });
  });

  it("resolves a run:<id> target to a run view without cloning", async () => {
    mocks.fetchPipelineRun.mockResolvedValue({ pipeline_name: null });

    const view = await resolveWorkareaTarget("run:456", options);

    expect(view).toEqual({ kind: "run", title: "Run 456", runId: "456" });
  });

  it("still opens a run tab when the metadata fetch fails", async () => {
    mocks.fetchPipelineRun.mockRejectedValue(new Error("boom"));

    const view = await resolveWorkareaTarget("run:789", options);

    expect(view).toEqual({ kind: "run", title: "Run 789", runId: "789" });
  });

  it("resolves an http URL to an artifact view", async () => {
    const view = await resolveWorkareaTarget(
      "https://host/artifact.txt",
      options,
    );

    expect(view).toEqual({
      kind: "artifact",
      title: "https://host/artifact.txt",
      url: "https://host/artifact.txt",
    });
    expect(mocks.fetchPipelineRun).not.toHaveBeenCalled();
  });

  it("treats an unknown target as a pipeline name", async () => {
    const view = await resolveWorkareaTarget("My Draft", options);

    expect(view).toEqual({
      kind: "pipeline",
      title: "My Draft",
      pipelineRef: { name: "My Draft" },
    });
  });
});

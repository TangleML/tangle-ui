import { afterEach, describe, expect, it, vi } from "vitest";

import { client } from "@/api/client.gen";

import { getPipelineSpec, PipelineSpecApiError } from "./pipelineSpecService";

vi.mock("@/api/client.gen", () => ({
  client: { get: vi.fn() },
}));

const spec = {
  name: "Hello World",
  implementation: { graph: { tasks: {} } },
};

function mockResponse(data: unknown, status = 200) {
  vi.mocked(client.get).mockResolvedValue({
    data,
    response: { status },
  } as unknown as ReturnType<typeof client.get>);
}

describe("getPipelineSpec", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("asks for the pipeline by its id", async () => {
    mockResponse({
      id: "pipeline-1",
      root_pipeline_task: { componentRef: { spec } },
    });

    await getPipelineSpec("pipeline-1");

    expect(client.get).toHaveBeenCalledWith({
      url: "/api/pipelines/{pipeline_id}",
      path: { pipeline_id: "pipeline-1" },
    });
  });

  it("digs the component spec out of the root task", async () => {
    mockResponse({
      id: "pipeline-1",
      file_path: "Hello World",
      root_pipeline_task: { componentRef: { spec } },
    });

    await expect(getPipelineSpec("pipeline-1")).resolves.toEqual({
      editorName: "Hello World",
      spec,
    });
  });

  it("hands back the path the editor opens, not the pipeline's title", async () => {
    mockResponse({
      id: "pipeline-1",
      file_path: "drafts/churn v3",
      pipeline_name: "Churn model",
      root_pipeline_task: { componentRef: { spec } },
    });

    const pipeline = await getPipelineSpec("pipeline-1");

    expect(pipeline.editorName).toBe("drafts/churn v3");
  });

  it("throws with the status when the backend gives nothing back", async () => {
    mockResponse(undefined, 404);

    await expect(getPipelineSpec("pipeline-1")).rejects.toThrow(
      PipelineSpecApiError,
    );
    await expect(getPipelineSpec("pipeline-1")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuses a pipeline whose root task holds no spec", async () => {
    mockResponse({
      id: "pipeline-1",
      root_pipeline_task: { componentRef: {} },
    });

    await expect(getPipelineSpec("pipeline-1")).rejects.toThrow(
      /holds no component spec/,
    );
  });

  it("refuses a pipeline with no root task at all", async () => {
    mockResponse({ id: "pipeline-1", root_pipeline_task: null });

    await expect(getPipelineSpec("pipeline-1")).rejects.toThrow(
      PipelineSpecApiError,
    );
  });
});

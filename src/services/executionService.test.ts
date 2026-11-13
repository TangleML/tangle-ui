import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import {
  fetchContainerExecutionState,
  fetchContainerLog,
  fetchExecutionDetails,
  fetchExecutionState,
  fetchPipelineRun,
  getExecutionArtifacts,
} from "./executionService";

const BACKEND_URL = "https://api.example.com";

describe("execution and run addresses", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const requested = () => mockFetch.mock.calls.map(([url]) => url);

  it("leaves an ordinary id as it is", async () => {
    await fetchExecutionState("exec-1", BACKEND_URL);
    await fetchExecutionDetails("019a3f0c7d2e", BACKEND_URL);
    await fetchPipelineRun("42", BACKEND_URL);
    await fetchContainerExecutionState("exec_2", BACKEND_URL);
    await fetchContainerLog("exec-3", BACKEND_URL);
    await getExecutionArtifacts("exec-4", BACKEND_URL);

    expect(requested()).toEqual([
      `${BACKEND_URL}/api/executions/exec-1/state`,
      `${BACKEND_URL}/api/executions/019a3f0c7d2e/details`,
      `${BACKEND_URL}/api/pipeline_runs/42`,
      `${BACKEND_URL}/api/executions/exec_2/container_state`,
      `${BACKEND_URL}/api/executions/exec-3/container_log`,
      `${BACKEND_URL}/api/executions/exec-4/artifacts`,
    ]);
  });

  it("keeps an id inside its own part of the address", async () => {
    await fetchExecutionState("../pipeline_runs/7/cancel?x=1#", BACKEND_URL);
    await fetchExecutionDetails("e/../../secrets", BACKEND_URL);
    await fetchPipelineRun("7/cancel", BACKEND_URL);

    expect(requested()).toEqual([
      `${BACKEND_URL}/api/executions/..%2Fpipeline_runs%2F7%2Fcancel%3Fx%3D1%23/state`,
      `${BACKEND_URL}/api/executions/e%2F..%2F..%2Fsecrets/details`,
      `${BACKEND_URL}/api/pipeline_runs/7%2Fcancel`,
    ]);
  });
});

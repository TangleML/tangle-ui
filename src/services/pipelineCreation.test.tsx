import { afterEach, beforeEach, expect, it, vi } from "vitest";

import * as backendSettings from "@/utils/backendSettings";

import { copyRunToPipeline } from "./pipelineRunService";
import {
  createPipelineFromSpec,
  getPipelineCreationBackendUrl,
} from "./pipelineStorage/pipelineCreation";
import type { PipelineFile } from "./pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "./pipelineStorage/PipelineStorageService";

vi.mock("@/utils/backendSettings", () => ({
  getBackendSettings: vi.fn(),
  selectBackendUrl: (_useEnv: boolean, _relative: boolean, url: string) => url,
}));

const createRemotePipeline = vi.fn();
const storage = { createRemotePipeline } as unknown as PipelineStorageService;
const spec = {
  name: "Example",
  inputs: [{ name: "greeting", type: "String", value: "before" }],
  implementation: { graph: { tasks: {} } },
};

beforeEach(() => {
  vi.mocked(backendSettings.getBackendSettings).mockResolvedValue({
    useEnv: false,
    useRelativePath: false,
    userBackendUrl: "https://backend.example",
  });
  createRemotePipeline.mockResolvedValue({
    id: "pipeline-1",
    remote: { backendUrl: "https://backend.example", pipelineId: "pipeline-1" },
  } as PipelineFile);
});
afterEach(() => vi.resetAllMocks());

it("creates the pipeline on the configured backend", async () => {
  await createPipelineFromSpec(storage, spec.name, spec);
  expect(createRemotePipeline).toHaveBeenCalledWith(
    "https://backend.example",
    spec.name,
    spec,
  );
});

it("keeps an explicitly resolved destination when settings change", async () => {
  const backendUrl = await getPipelineCreationBackendUrl();
  vi.mocked(backendSettings.getBackendSettings).mockResolvedValue({
    useEnv: false,
    useRelativePath: false,
    userBackendUrl: "https://other.example",
  });
  await createPipelineFromSpec(storage, spec.name, spec, { backendUrl });
  expect(createRemotePipeline).toHaveBeenCalledWith(
    "https://backend.example",
    spec.name,
    spec,
  );
  expect(backendSettings.getBackendSettings).toHaveBeenCalledTimes(1);
});

it("requires a backend for pipeline creation", async () => {
  vi.mocked(backendSettings.getBackendSettings).mockResolvedValue({
    useEnv: false,
    useRelativePath: false,
    userBackendUrl: "",
  });
  await expect(
    createPipelineFromSpec(storage, spec.name, spec),
  ).rejects.toThrow("Configure a backend");
  expect(createRemotePipeline).not.toHaveBeenCalled();
});

it("copies a run into a remote pipeline with its inputs and origin", async () => {
  const result = await copyRunToPipeline(storage, spec, "run-7", "Clone", {
    greeting: "after",
  });
  expect(result).toMatchObject({
    name: "Clone",
    url: "/editor/pipeline/pipeline-1",
  });
  expect(createRemotePipeline.mock.calls[0][2]).toMatchObject({
    name: "Clone",
    inputs: [{ value: "after" }],
    metadata: { annotations: { cloned_from_run_id: "run-7" } },
  });
  expect(spec.inputs[0].value).toBe("before");
  expect(backendSettings.getBackendSettings).toHaveBeenCalledTimes(1);
});

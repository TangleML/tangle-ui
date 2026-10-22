import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPipelineFromSpec } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import { componentSpecToYaml } from "@/utils/yaml";

import {
  importPipelineFromFile,
  importPipelineFromYaml,
} from "./pipelineService";

vi.mock("@/services/pipelineStorage/pipelineCreation", () => ({
  createPipelineFromSpec: vi.fn(),
}));
const storage = {} as PipelineStorageService;
const remote = {
  backendUrl: "https://backend.example",
  pipelineId: "pipeline-1",
};
const spec = {
  name: "Test Pipeline",
  implementation: { graph: { tasks: {} } },
};

beforeEach(() => {
  vi.mocked(createPipelineFromSpec).mockResolvedValue({
    id: remote.pipelineId,
    remote,
  } as PipelineFile);
});
afterEach(() => vi.resetAllMocks());

describe("pipeline import", () => {
  it("saves a graph pipeline remotely and returns its editor route", async () => {
    const result = await importPipelineFromYaml(
      storage,
      componentSpecToYaml(spec),
    );
    expect(result).toEqual({
      successful: true,
      name: spec.name,
      remote: { source: "remote", ...remote },
      url: "/editor/pipeline/pipeline-1",
    });
    expect(createPipelineFromSpec).toHaveBeenCalledWith(
      storage,
      spec.name,
      spec,
    );
  });

  it("keeps duplicate names because remote pipelines have distinct IDs", async () => {
    await importPipelineFromYaml(storage, componentSpecToYaml(spec));
    await importPipelineFromYaml(storage, componentSpecToYaml(spec));
    expect(createPipelineFromSpec).toHaveBeenCalledTimes(2);
    expect(createPipelineFromSpec).toHaveBeenLastCalledWith(
      storage,
      spec.name,
      spec,
    );
  });

  it("supplies a name for an unnamed graph", async () => {
    const result = await importPipelineFromYaml(
      storage,
      componentSpecToYaml({ implementation: spec.implementation }),
    );
    expect(result).toMatchObject({
      successful: true,
      name: "Imported Pipeline",
    });
    expect(vi.mocked(createPipelineFromSpec).mock.calls[0][2].name).toBe(
      "Imported Pipeline",
    );
  });

  it("reports malformed YAML without saving", async () => {
    expect(
      await importPipelineFromYaml(storage, "invalid: yaml: content: -"),
    ).toMatchObject({
      successful: false,
      errorMessage: expect.stringContaining("YAML syntax error"),
    });
    expect(createPipelineFromSpec).not.toHaveBeenCalled();
  });

  it("rejects a container component without saving", async () => {
    const container = {
      name: "Container",
      implementation: { container: { image: "example" } },
    };
    expect(
      await importPipelineFromYaml(storage, componentSpecToYaml(container)),
    ).toMatchObject({
      successful: false,
      errorMessage: expect.stringContaining("graph pipeline"),
    });
    expect(createPipelineFromSpec).not.toHaveBeenCalled();
  });

  it("returns the remote failure instead of reporting a successful import", async () => {
    vi.mocked(createPipelineFromSpec).mockRejectedValue(
      new Error("Backend unavailable"),
    );
    expect(
      await importPipelineFromYaml(storage, componentSpecToYaml(spec)),
    ).toMatchObject({ successful: false, errorMessage: "Backend unavailable" });
  });

  it("reports a file read failure", async () => {
    const file = {
      text: async () => {
        throw new Error("Read failed");
      },
    } as unknown as File;
    expect(await importPipelineFromFile(storage, file)).toMatchObject({
      successful: false,
      errorMessage: "Read failed",
    });
  });
});

import * as yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registeredStorageKeys } from "@/services/pipelineStorage/pipelineRegistry";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import * as componentStore from "@/utils/componentStore";

import { importPipelineFromYaml } from "./pipelineService";

vi.mock("@/services/pipelineStorage/pipelineRegistry", () => ({
  registeredStorageKeys: vi.fn(),
}));

const addFile = vi.fn();
const write = vi.fn();
const resolvePipeline = vi.fn();
const storage = {
  rootFolder: { addFile },
  resolvePipeline,
} as unknown as PipelineStorageService;

describe("importPipelineFromYaml", () => {
  const validYamlObject = {
    name: "Test Pipeline",
    metadata: {
      annotations: {
        sdk: "https://cloud-pipelines.net/pipeline-editor/",
      },
    },
    implementation: {
      graph: {
        tasks: [],
        outputValues: [],
      },
    },
  };

  const validYamlContent = yaml.dump(validYamlObject);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_LOCAL_PIPELINES", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
    addFile.mockResolvedValue({ id: "local-1" });
    resolvePipeline.mockResolvedValue({ write });

    vi.spyOn(componentStore, "getComponentFileFromList").mockResolvedValue(
      null,
    );
    vi.spyOn(componentStore, "getComponentFileNamesFromList").mockResolvedValue(
      [],
    );
    vi.mocked(registeredStorageKeys).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  it("should successfully import a valid pipeline", async () => {
    // Mock no existing pipeline with the same name
    vi.mocked(componentStore.getComponentFileFromList).mockResolvedValue(null);

    const result = await importPipelineFromYaml(storage, validYamlContent);

    expect(addFile).toHaveBeenCalled();

    // Expect successful result
    expect(result).toEqual({
      name: "Test Pipeline",
      overwritten: false,
      successful: true,
    });
  });

  it("describes an adjusted non-colliding name without claiming a conflict", async () => {
    const result = await importPipelineFromYaml(
      storage,
      yaml.dump({ ...validYamlObject, name: "Test Pipeline " }),
    );
    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline");
    expect(result.errorMessage).toContain("during import");
    expect(result.errorMessage).not.toContain("conflict");
  });

  it("should generate a unique name when a name collision occurs", async () => {
    vi.mocked(componentStore.getComponentFileNamesFromList).mockResolvedValue([
      "Test Pipeline",
    ]);
    vi.mocked(componentStore.getComponentFileFromList).mockImplementation(
      async (_, name) => {
        if (name === "Test Pipeline") {
          return {} as any;
        }
        return null;
      },
    );

    const result = await importPipelineFromYaml(
      storage,
      validYamlContent,
      false,
    );

    // Since we're now renaming rather than erroring, expect a successful result
    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline 2");
    expect(result.errorMessage).toContain("was renamed");

    expect(addFile).toHaveBeenCalledWith(
      "Test Pipeline 2",
      expect.stringContaining("name: Test Pipeline 2"),
    );
  });

  it("should increment counter when multiple name collisions occur", async () => {
    vi.mocked(componentStore.getComponentFileNamesFromList).mockResolvedValue([
      "Test Pipeline",
      "Test Pipeline 2",
    ]);
    vi.mocked(registeredStorageKeys).mockResolvedValue(["Test Pipeline 3"]);
    vi.mocked(componentStore.getComponentFileFromList).mockImplementation(
      async (_, name) => {
        if (
          name === "Test Pipeline" ||
          name === "Test Pipeline 2" ||
          name === "Test Pipeline 3"
        ) {
          return {} as any;
        }
        return null;
      },
    );

    const result = await importPipelineFromYaml(
      storage,
      validYamlContent,
      false,
    );

    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline 4");

    expect(addFile).toHaveBeenCalledWith(
      "Test Pipeline 4",
      yaml.dump({
        ...validYamlObject,
        name: "Test Pipeline 4",
      }),
    );
  });

  it("should handle invalid YAML content", async () => {
    const result = await importPipelineFromYaml(
      storage,
      "invalid: yaml: content: -",
    );

    // Expect unsuccessful result
    expect(result.successful).toBe(false);
    expect(result.errorMessage).toBeDefined();
    expect(result.name).toBe("");
  });

  it.each([false, true])(
    "avoids a registry-only name even when overwrite is %s",
    async (overwrite) => {
      vi.mocked(registeredStorageKeys).mockResolvedValue(["Test Pipeline"]);

      const result = await importPipelineFromYaml(
        storage,
        validYamlContent,
        overwrite,
      );

      expect(result).toMatchObject({
        name: "Test Pipeline 2",
        overwritten: false,
        successful: true,
      });
      expect(addFile).toHaveBeenCalledWith(
        "Test Pipeline 2",
        expect.stringContaining("name: Test Pipeline 2"),
      );
      expect(resolvePipeline).not.toHaveBeenCalled();
    },
  );

  it("should handle non-graph pipelines", async () => {
    const containerPipelineObj = {
      name: "Container Pipeline",
      implementation: {
        container: {
          image: "test-image",
          command: ["echo", "hello"],
        },
      },
    };
    const containerPipeline = yaml.dump(containerPipelineObj);

    const result = await importPipelineFromYaml(storage, containerPipeline);

    // Expect unsuccessful result
    expect(result.successful).toBe(false);
    expect(result.errorMessage).toContain("graph-based pipeline");

    // Expect the writing function not to be called
    expect(addFile).not.toHaveBeenCalled();
  });

  it("should use default name for unnamed pipelines", async () => {
    const unnamedPipelineSpec = {
      metadata: {
        annotations: {
          sdk: "https://cloud-pipelines.net/pipeline-editor/",
        },
      },
      implementation: {
        graph: {
          tasks: {},
          outputValues: {},
        },
      },
    };

    const unnamedYaml = yaml.dump(unnamedPipelineSpec);

    vi.mocked(componentStore.getComponentFileFromList).mockResolvedValue(null);

    const result = await importPipelineFromYaml(storage, unnamedYaml);

    expect(addFile).toHaveBeenCalledWith("Imported Pipeline", unnamedYaml);

    expect(result.name).toBe("Imported Pipeline");
  });

  it("overwrites an existing local pipeline through its storage file", async () => {
    vi.mocked(componentStore.getComponentFileFromList).mockResolvedValue(
      {} as never,
    );

    const result = await importPipelineFromYaml(
      storage,
      validYamlContent,
      true,
    );

    expect(result.overwritten).toBe(true);
    expect(resolvePipeline).toHaveBeenCalledWith({ name: "Test Pipeline" });
    expect(write).toHaveBeenCalledWith(validYamlContent);
    expect(addFile).not.toHaveBeenCalled();
  });
});

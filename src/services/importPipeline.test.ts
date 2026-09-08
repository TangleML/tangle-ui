import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importPipelineFromYaml } from "./pipelineService";

const { existingNames, savePipeline } = vi.hoisted(() => ({
  existingNames: new Set<string>(),
  savePipeline: vi.fn(),
}));

vi.mock("./pipelineStorage/pipelineOperations", () => ({
  findPipelineFile: vi.fn(async () => undefined),
  listPipelineFiles: vi.fn(async () =>
    [...existingNames].map((displayName) => ({ displayName })),
  ),
  savePipeline,
}));

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
    vi.spyOn(console, "error").mockImplementation(() => {});
    existingNames.clear();
    savePipeline.mockImplementation(async (name: string) => ({
      id: `id-for-${name}`,
      displayName: name,
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully import a valid pipeline", async () => {
    const result = await importPipelineFromYaml(validYamlContent);

    expect(savePipeline).toHaveBeenCalled();

    expect(result).toEqual({
      name: "Test Pipeline",
      fileId: "id-for-Test Pipeline",
      overwritten: false,
      successful: true,
    });
  });

  it("should generate a unique name when a name collision occurs", async () => {
    existingNames.add("Test Pipeline");

    const result = await importPipelineFromYaml(validYamlContent, false);

    // Since we're now renaming rather than erroring, expect a successful result
    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline (1)");
    expect(result.errorMessage).toContain("was renamed");

    expect(savePipeline).toHaveBeenCalledWith(
      "Test Pipeline (1)",
      expect.stringContaining("name: Test Pipeline (1)"),
    );
  });

  it("should increment counter when multiple name collisions occur", async () => {
    existingNames.add("Test Pipeline");
    existingNames.add("Test Pipeline (1)");
    existingNames.add("Test Pipeline (2)");

    const result = await importPipelineFromYaml(validYamlContent, false);

    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline (3)");

    expect(savePipeline).toHaveBeenCalledWith(
      "Test Pipeline (3)",
      yaml.dump({
        ...validYamlObject,
        name: "Test Pipeline (3)",
      }),
    );
  });

  it("overwrites the existing pipeline when asked to", async () => {
    existingNames.add("Test Pipeline");

    const result = await importPipelineFromYaml(validYamlContent, true);

    expect(result.overwritten).toBe(true);
    expect(result.name).toBe("Test Pipeline");
    expect(savePipeline).toHaveBeenCalledWith(
      "Test Pipeline",
      expect.stringContaining("name: Test Pipeline"),
    );
  });

  it("should handle invalid YAML content", async () => {
    const result = await importPipelineFromYaml("invalid: yaml: content: -");

    expect(result.successful).toBe(false);
    expect(result.errorMessage).toBeDefined();
    expect(result.name).toBe("");
  });

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

    const result = await importPipelineFromYaml(containerPipeline);

    expect(result.successful).toBe(false);
    expect(result.errorMessage).toContain("graph-based pipeline");

    expect(savePipeline).not.toHaveBeenCalled();
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

    const result = await importPipelineFromYaml(unnamedYaml);

    expect(savePipeline).toHaveBeenCalledWith("Imported Pipeline", unnamedYaml);

    expect(result.name).toBe("Imported Pipeline");
  });
});

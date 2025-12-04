import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as componentStore from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import { importPipelineFromYaml } from "./pipelineService";

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
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.spyOn(componentStore, "getComponentFileFromList").mockResolvedValue(
      null,
    );
    vi.spyOn(componentStore, "writeComponentToFileListFromText");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should successfully import a valid pipeline", async () => {
    // Mock no existing pipeline with the same name
    vi.mocked(componentStore.getComponentFileFromList).mockResolvedValue(null);

    const result = await importPipelineFromYaml(validYamlContent);

    // Expect writeComponentToFileListFromText to be called with correct parameters
    expect(componentStore.writeComponentToFileListFromText).toHaveBeenCalled();

    // Expect successful result
    expect(result).toEqual({
      name: "Test Pipeline",
      overwritten: false,
      successful: true,
    });
  });

  it("should generate a unique name when a name collision occurs", async () => {
    // Mock existing pipeline with the same name, but not with "(1)" suffix
    vi.mocked(componentStore.getComponentFileFromList).mockImplementation(
      async (_, name) => {
        if (name === "Test Pipeline") {
          return {} as any;
        }
        return null;
      },
    );

    const result = await importPipelineFromYaml(validYamlContent, false);

    // Since we're now renaming rather than erroring, expect a successful result
    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline (1)");
    expect(result.errorMessage).toContain("was renamed");

    // Expect writeComponentToFileListFromText to be called with the new name and YAML
    expect(
      componentStore.writeComponentToFileListFromText,
    ).toHaveBeenCalledWith(
      USER_PIPELINES_LIST_NAME,
      "Test Pipeline (1)",
      expect.stringContaining("name: Test Pipeline (1)"),
    );
  });

  it("should increment counter when multiple name collisions occur", async () => {
    // Mock existing pipelines with the name and first two numbered variants
    vi.mocked(componentStore.getComponentFileFromList).mockImplementation(
      async (_, name) => {
        if (
          name === "Test Pipeline" ||
          name === "Test Pipeline (1)" ||
          name === "Test Pipeline (2)"
        ) {
          return {} as any;
        }
        return null;
      },
    );

    const result = await importPipelineFromYaml(validYamlContent, false);

    // Expect a successful result with the name incremented to (3)
    expect(result.successful).toBe(true);
    expect(result.name).toBe("Test Pipeline (3)");

    // Expect writeComponentToFileListFromText to be called with the new name and YAML
    expect(
      componentStore.writeComponentToFileListFromText,
    ).toHaveBeenCalledWith(
      USER_PIPELINES_LIST_NAME,
      "Test Pipeline (3)",
      yaml.dump({
        ...validYamlObject,
        name: "Test Pipeline (3)",
      }),
    );
  });

  it("should handle invalid YAML content", async () => {
    const result = await importPipelineFromYaml("invalid: yaml: content: -");

    // Expect unsuccessful result
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

    // Expect unsuccessful result
    expect(result.successful).toBe(false);
    expect(result.errorMessage).toContain("graph-based pipeline");

    // Expect the writing function not to be called
    expect(
      componentStore.writeComponentToFileListFromText,
    ).not.toHaveBeenCalled();
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

    const result = await importPipelineFromYaml(unnamedYaml);

    // Expect writeComponentToFileListFromText to be called with default name
    expect(
      componentStore.writeComponentToFileListFromText,
    ).toHaveBeenCalledWith(
      USER_PIPELINES_LIST_NAME,
      "Imported Pipeline",
      unnamedYaml,
    );

    expect(result.name).toBe("Imported Pipeline");
  });
});

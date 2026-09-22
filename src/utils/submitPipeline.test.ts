import yaml from "js-yaml";
import { observable } from "mobx";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import * as pipelineRunService from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { type ComponentSpec, isGraphImplementation } from "./componentSpec";
import { projectRunAnnotations } from "./projectRunAnnotation";
import { submitPipelineRun } from "./submitPipeline";

// Mock dependencies
vi.mock("@/services/pipelineRunService", () => ({
  createPipelineRun: vi.fn(),
  savePipelineRun: vi.fn(),
}));

describe("submitPipelineRun", () => {
  const mockBackendUrl = "https://api.example.com";
  const mockAuthToken = "test-auth-token";

  let mockFetch: Mock;

  const mockPipelineRun: PipelineRun = {
    id: 123,
    root_execution_id: 456,
    created_at: "2024-01-01T00:00:00Z",
    created_by: "test-user",
    pipeline_name: "test-pipeline",
    status: "RUNNING",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Setup default mocks
    vi.mocked(pipelineRunService.createPipelineRun).mockResolvedValue(
      mockPipelineRun,
    );
    vi.mocked(pipelineRunService.savePipelineRun).mockResolvedValue(
      mockPipelineRun,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("pre-submit hooks", () => {
    afterEach(() => {
      delete window.__TANGLE_PRE_SUBMIT_HOOKS__;
    });

    const componentSpec: ComponentSpec = {
      name: "hooked-component",
      implementation: { container: { image: "test:latest" } },
    };

    it("awaits a registered hook before submitting", async () => {
      const order: string[] = [];
      const hook = vi.fn(async () => {
        order.push("hook");
        return { proceed: true };
      });
      vi.mocked(pipelineRunService.createPipelineRun).mockImplementation(
        async () => {
          order.push("create");
          return mockPipelineRun;
        },
      );
      window.__TANGLE_PRE_SUBMIT_HOOKS__ = [hook];

      await submitPipelineRun(componentSpec, mockBackendUrl);

      expect(hook).toHaveBeenCalledWith({
        componentSpec,
        taskArguments: undefined,
      });
      expect(order).toEqual(["hook", "create"]);
    });

    it("skips submission and does not call onError when a hook declines", async () => {
      const mockOnError = vi.fn();
      const mockOnSuccess = vi.fn();
      window.__TANGLE_PRE_SUBMIT_HOOKS__ = [
        vi.fn(async () => ({ proceed: false })),
      ];

      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onSuccess: mockOnSuccess,
        onError: mockOnError,
      });

      expect(pipelineRunService.createPipelineRun).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("forwards taskArguments to the hook context", async () => {
      const hook = vi.fn(async () => ({ proceed: true }));
      window.__TANGLE_PRE_SUBMIT_HOOKS__ = [hook];

      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: { param1: "value1" },
      });

      expect(hook).toHaveBeenCalledWith({
        componentSpec,
        taskArguments: { param1: "value1" },
      });
    });
  });

  describe("basic functionality", () => {
    it("should successfully submit a simple component spec", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "simple-component",
        implementation: {
          container: {
            image: "test:latest",
          },
        },
      };

      const mockOnSuccess = vi.fn();
      const mockOnError = vi.fn();

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        authorizationToken: mockAuthToken,
        onSuccess: mockOnSuccess,
        onError: mockOnError,
      });

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {},
            annotations: {},
          },
        },
        mockBackendUrl,
        mockAuthToken,
      );
      expect(pipelineRunService.savePipelineRun).toHaveBeenCalledWith(
        mockPipelineRun,
        "simple-component",
        undefined,
        undefined,
      );
      expect(mockOnSuccess).toHaveBeenCalledWith(mockPipelineRun);
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it("should include arguments when componentSpec has inputs with values", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-with-args",
        inputs: [
          { name: "param1", value: "value1" },
          { name: "param2", value: "value2" },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: { param1: "value1", param2: "value2" },
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should work without optional parameters", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "minimal-component",
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        expect.any(Object),
        mockBackendUrl,
        undefined,
      );
    });

    it("merges runAnnotations into the run-level payload annotations", async () => {
      const componentSpec: ComponentSpec = {
        name: "annotated-component",
        implementation: { container: { image: "test:latest" } },
      };

      await submitPipelineRun(componentSpec, mockBackendUrl, {
        runAnnotations: {
          "tangleml.com/project/project-id/project-42": "true",
        },
      });

      const [payload] = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0]!;
      expect(payload.annotations).toEqual({
        source: "web-app",
        "tangleml.com/project/project-id/project-42": "true",
      });
    });

    it("keeps only the source annotation when runAnnotations is omitted", async () => {
      const componentSpec: ComponentSpec = {
        name: "unannotated-component",
        implementation: { container: { image: "test:latest" } },
      };

      await submitPipelineRun(componentSpec, mockBackendUrl);

      const [payload] = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0]!;
      expect(payload.annotations).toEqual({ source: "web-app" });
    });

    it("should use 'Pipeline' as default name when componentSpec.name is undefined", async () => {
      const componentSpec: ComponentSpec = {
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.savePipelineRun).toHaveBeenCalledWith(
        mockPipelineRun,
        "Pipeline",
        undefined,
        undefined,
      );
    });
  });

  describe("attributing a run to a project", () => {
    const spec: ComponentSpec = {
      name: "churn-training",
      implementation: { container: { image: "test:latest" } },
    };
    const PROJECT = "035d6de5-23d6-402b-ad7e-9a7359194caf";
    const OTHER = "a1a58adc-e035-47de-afea-0eef486bb82f";

    const submittedPayload = () =>
      vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0][0] as unknown as {
        annotations: Record<string, string>;
        root_task: { componentRef: { spec: ComponentSpec } };
      };

    /**
     * The project has to be named on the run itself, not inside the spec: the
     * endpoint that sets one annotation later rejects this key for its
     * slashes, so submission is the only chance to get attribution right.
     */
    it("names the project on the run, beside the source that was always there", async () => {
      await submitPipelineRun(spec, mockBackendUrl, {
        runAnnotations: projectRunAnnotations([PROJECT]),
      });

      expect(submittedPayload().annotations).toEqual({
        source: "web-app",
        [`tangleml.com/project/project-id/${PROJECT}`]: "true",
      });
    });

    it("leaves the pipeline's own annotations out of it", async () => {
      await submitPipelineRun(spec, mockBackendUrl, {
        runAnnotations: projectRunAnnotations([PROJECT]),
      });

      expect(
        submittedPayload().root_task.componentRef.spec.metadata?.annotations,
      ).toBeUndefined();
    });

    it("keeps every project of a run that belongs to more than one", async () => {
      await submitPipelineRun(spec, mockBackendUrl, {
        runAnnotations: projectRunAnnotations([PROJECT, OTHER]),
      });

      expect(Object.keys(submittedPayload().annotations)).toEqual([
        `tangleml.com/project/project-id/${PROJECT}`,
        `tangleml.com/project/project-id/${OTHER}`,
        "source",
      ]);
    });

    /** Every run in the app goes through here, so no project must change nothing. */
    it("annotates nothing extra when there is no project", async () => {
      await submitPipelineRun(spec, mockBackendUrl, {
        runAnnotations: projectRunAnnotations([]),
      });

      expect(submittedPayload().annotations).toEqual({ source: "web-app" });
    });
  });

  describe("run name template", () => {
    const templatedSpec = (template: string): ComponentSpec => ({
      name: "my-pipeline",
      inputs: [{ name: "dataset", default: "iris" }],
      implementation: { container: { image: "test:latest" } },
      metadata: { annotations: { "run-name-template": template } },
    });

    it("resolves the template into the submitted run name", async () => {
      await submitPipelineRun(
        templatedSpec("${arguments.dataset}-run"),
        mockBackendUrl,
      );

      const [payload] = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0]!;
      expect(payload.root_task.componentRef.spec!.name).toBe("iris-run");
    });

    it("preserves the pipeline name as the canonical name annotation", async () => {
      await submitPipelineRun(
        templatedSpec("${arguments.dataset}-run"),
        mockBackendUrl,
      );

      const [payload] = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0]!;
      expect(payload.root_task.annotations).toEqual({
        "canonical-pipeline-name": "my-pipeline",
      });
      expect(pipelineRunService.savePipelineRun).toHaveBeenCalledWith(
        mockPipelineRun,
        "my-pipeline",
        undefined,
        "iris-run",
      );
    });

    it("prefers taskArguments over input defaults when resolving placeholders", async () => {
      await submitPipelineRun(
        templatedSpec("${arguments.dataset}-run"),
        mockBackendUrl,
        { taskArguments: { dataset: "titanic" } },
      );

      const [payload] = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0]!;
      expect(payload.root_task.componentRef.spec!.name).toBe("titanic-run");
    });

    it("leaves the pipeline name untouched when there is no template", async () => {
      const componentSpec: ComponentSpec = {
        name: "my-pipeline",
        implementation: { container: { image: "test:latest" } },
      };

      await submitPipelineRun(componentSpec, mockBackendUrl);

      const [payload] = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0]!;
      expect(payload.root_task.componentRef.spec!.name).toBe("my-pipeline");
      expect(payload.root_task.annotations).toEqual({});
    });
  });

  describe("taskArguments handling", () => {
    it("should include taskArguments in payload when provided", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-with-task-args",
        implementation: { container: { image: "test:latest" } },
      };

      const mockTaskArguments = {
        inputA: "valueA",
        inputB: "valueB",
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: mockTaskArguments,
      });

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              inputA: "valueA",
              inputB: "valueB",
            },
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should merge taskArguments with argumentsFromInputs", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "merged-args-component",
        inputs: [
          { name: "fromInput1", value: "inputValue1" },
          { name: "fromInput2", value: "inputValue2" },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      const mockTaskArguments = {
        taskArg1: "taskValue1",
        taskArg2: "taskValue2",
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: mockTaskArguments,
      });

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              fromInput1: "inputValue1",
              fromInput2: "inputValue2",
              taskArg1: "taskValue1",
              taskArg2: "taskValue2",
            },
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should override argumentsFromInputs with taskArguments when keys conflict", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "override-args-component",
        inputs: [
          { name: "sharedKey", value: "fromInputValue" },
          { name: "uniqueInputKey", value: "inputOnlyValue" },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      const mockTaskArguments = {
        sharedKey: "fromTaskValue",
        uniqueTaskKey: "taskOnlyValue",
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: mockTaskArguments,
      });

      // Assert - taskArguments should override argumentsFromInputs
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              sharedKey: "fromTaskValue",
              uniqueInputKey: "inputOnlyValue",
              uniqueTaskKey: "taskOnlyValue",
            },
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should preserve non-string taskArguments values (e.g., SecretArguments)", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "preserve-args-component",
        implementation: { container: { image: "test:latest" } },
      };

      const mockTaskArguments = {
        stringArg: "validString",
        objectArg: { nested: "value" },
        numberArg: 123,
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: mockTaskArguments as any,
      });

      // Assert - all argument values should be preserved (non-strings like SecretArguments are valid)
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              stringArg: "validString",
              objectArg: { nested: "value" },
              numberArg: 123,
            },
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should work with empty taskArguments object", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "empty-task-args-component",
        inputs: [{ name: "inputArg", value: "inputValue" }],
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: {},
      });

      // Assert - should only contain argumentsFromInputs
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              inputArg: "inputValue",
            },
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should call onSuccess callback with taskArguments submission", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "success-callback-component",
        implementation: { container: { image: "test:latest" } },
      };

      const mockOnSuccess = vi.fn();
      const mockTaskArguments = { arg1: "value1" };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        taskArguments: mockTaskArguments,
        onSuccess: mockOnSuccess,
      });

      // Assert
      expect(mockOnSuccess).toHaveBeenCalledWith(mockPipelineRun);
    });
  });

  describe("component processing", () => {
    it("should fetch and process components with URLs", async () => {
      // Arrange
      const remoteComponentYaml = yaml.dump({
        name: "remote-component",
        implementation: { container: { image: "remote:latest" } },
      });

      const componentSpec: ComponentSpec = {
        name: "main-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/component.yaml",
                },
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(remoteComponentYaml),
      });

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/component.yaml",
        { signal: expect.any(AbortSignal) },
      );
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          annotations: { source: "web-app" },
          root_task: {
            componentRef: {
              spec: {
                name: "main-component",
                implementation: {
                  graph: {
                    tasks: {
                      "task-1": {
                        componentRef: {
                          url: "https://example.com/component.yaml",
                          text: remoteComponentYaml,
                          spec: {
                            name: "remote-component",
                            implementation: {
                              container: { image: "remote:latest" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            arguments: {},
            annotations: {},
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should use cached components for duplicate URLs", async () => {
      // Arrange
      const remoteComponentYaml = yaml.dump({
        name: "cached-component",
        implementation: { container: { image: "cached:latest" } },
      });

      const componentSpec: ComponentSpec = {
        name: "main-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/cached.yaml",
                },
              },
              "task-2": {
                componentRef: {
                  url: "https://example.com/cached.yaml",
                },
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(remoteComponentYaml),
      });

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/cached.yaml",
        { signal: expect.any(AbortSignal) },
      );
    });

    it("should recursively process nested graph components", async () => {
      // Arrange
      const nestedComponentYaml = yaml.dump({
        name: "nested-component",
        implementation: {
          graph: {
            tasks: {
              "nested-task": {
                componentRef: {
                  url: "https://example.com/deep-nested.yaml",
                },
              },
            },
          },
        },
      });

      const deepNestedYaml = yaml.dump({
        name: "deep-nested-component",
        implementation: { container: { image: "deep:latest" } },
      });

      const componentSpec: ComponentSpec = {
        name: "root-component",
        implementation: {
          graph: {
            tasks: {
              "root-task": {
                componentRef: {
                  url: "https://example.com/nested.yaml",
                },
              },
            },
          },
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(nestedComponentYaml),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(deepNestedYaml),
        });

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/nested.yaml",
        { signal: expect.any(AbortSignal) },
      );
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/deep-nested.yaml",
        { signal: expect.any(AbortSignal) },
      );
    });

    it("should skip processing when component already has spec", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "main-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/component.yaml",
                  spec: {
                    name: "existing-spec",
                    implementation: { container: { image: "existing:latest" } },
                  },
                },
              },
            },
          },
        },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle components without graph implementation", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "container-component",
        implementation: {
          container: {
            image: "simple:latest",
          },
        },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        expect.objectContaining({
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {},
            annotations: {},
          },
        }),
        mockBackendUrl,
        undefined,
      );
    });
  });

  describe("error handling", () => {
    it("should handle fetch network errors", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "failing-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/failing.yaml",
                },
              },
            },
          },
        },
      };

      const mockOnError = vi.fn();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onError: mockOnError,
      });

      // Assert
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
      expect(pipelineRunService.createPipelineRun).not.toHaveBeenCalled();
    });

    it("should handle HTTP error responses", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "not-found-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/notfound.yaml",
                },
              },
            },
          },
        },
      };

      const mockOnError = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onError: mockOnError,
      });

      // Assert
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to fetch component: Not Found (404)",
        }),
      );
    });

    it("should handle YAML parsing errors", async () => {
      // Arrange
      const invalidYaml = "{ invalid: yaml: content }}}";
      const componentSpec: ComponentSpec = {
        name: "invalid-yaml-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/invalid.yaml",
                },
              },
            },
          },
        },
      };

      const mockOnError = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(invalidYaml),
      });

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onError: mockOnError,
      });

      // Assert
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Invalid component format"),
        }),
      );
    });

    it("should handle empty component specification", async () => {
      // Arrange
      const emptyYaml = "";
      const componentSpec: ComponentSpec = {
        name: "empty-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/empty.yaml",
                },
              },
            },
          },
        },
      };

      const mockOnError = vi.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(emptyYaml),
      });

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onError: mockOnError,
      });

      // Assert
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(
            "Received empty component specification",
          ),
        }),
      );
    });

    it("should handle API errors during pipeline run creation", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "api-error-component",
        implementation: { container: { image: "test:latest" } },
      };

      const mockOnError = vi.fn();
      vi.mocked(pipelineRunService.createPipelineRun).mockRejectedValueOnce(
        new Error("API Error: Server unavailable"),
      );

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onError: mockOnError,
      });

      // Assert
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "API Error: Server unavailable",
        }),
      );
    });

    it("should handle fetch timeout", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "timeout-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/slow.yaml",
                },
              },
            },
          },
        },
      };

      const mockOnError = vi.fn();

      // Mock AbortController
      const mockAbort = vi.fn();
      vi.stubGlobal(
        "AbortController",
        class {
          signal = { aborted: false };
          abort = mockAbort;
        },
      );

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), 100);
          }),
      );

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl, {
        onError: mockOnError,
      });

      // Assert
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("edge cases", () => {
    it("should handle component spec without tasks", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "no-tasks-component",
        implementation: {
          graph: {
            tasks: {},
          },
        },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        expect.objectContaining({
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {},
            annotations: {},
          },
        }),
        mockBackendUrl,
        undefined,
      );
    });

    it("should handle tasks with invalid structure", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "invalid-tasks-component",
        implementation: {
          graph: {
            tasks: {
              "invalid-task": "not an object" as any,
              "missing-ref": {} as any,
              "null-ref": { componentRef: null } as any,
            },
          },
        },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        expect.objectContaining({
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {},
            annotations: {},
          },
        }),
        mockBackendUrl,
        undefined,
      );
    });

    it("should skip saving pipeline run when response has no id", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "no-id-response",
        implementation: { container: { image: "test:latest" } },
      };

      const pipelineRunWithoutId = {
        root_execution_id: 456,
        created_at: "2024-01-01T00:00:00Z",
        created_by: "test-user",
        pipeline_name: "test-pipeline",
        status: "RUNNING",
      } as PipelineRun;

      vi.mocked(pipelineRunService.createPipelineRun).mockResolvedValueOnce(
        pipelineRunWithoutId,
      );

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.savePipelineRun).not.toHaveBeenCalled();
    });

    it("should handle component spec with digest annotation", async () => {
      // Arrange
      const testDigest = "sha256:abcd1234";
      const componentSpec: ComponentSpec = {
        name: "digest-component",
        metadata: {
          annotations: {
            digest: testDigest,
          },
        },
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.savePipelineRun).toHaveBeenCalledWith(
        expect.any(Object),
        "digest-component",
        testDigest,
        undefined,
      );
    });

    it("should not mutate the original component spec", async () => {
      // Arrange
      const originalSpec: ComponentSpec = {
        name: "immutable-component",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: {
                  url: "https://example.com/component.yaml",
                },
              },
            },
          },
        },
      };

      const specCopy = structuredClone(originalSpec);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            yaml.dump({
              name: "fetched-component",
              implementation: { container: { image: "fetched:latest" } },
            }),
          ),
      });

      // Act
      await submitPipelineRun(originalSpec, mockBackendUrl);

      // Assert
      expect(originalSpec).toEqual(specCopy);
      if (isGraphImplementation(originalSpec.implementation)) {
        expect(
          originalSpec.implementation.graph.tasks["task-1"].componentRef.spec,
        ).toBeUndefined();
      }
    });

    /**
     * An agent submits the spec straight off the editor's store, where
     * `serializeComponentSpec` passes each `componentRef` through by reference.
     * The wire object is plain but the reference inside it is still live, and
     * `structuredClone` refuses it — the submit died before a run was created.
     */
    it("submits a spec that still holds a live observable inside it", async () => {
      const spec: ComponentSpec = {
        name: "from-the-editor",
        implementation: {
          graph: {
            tasks: {
              "task-1": {
                componentRef: observable({
                  url: "https://example.com/component.yaml",
                }),
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            yaml.dump({
              name: "fetched-component",
              implementation: { container: { image: "fetched:latest" } },
            }),
          ),
      });
      const onError = vi.fn();

      await submitPipelineRun(spec, mockBackendUrl, { onError });

      expect(onError).not.toHaveBeenCalled();
    });
  });
});

import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as pipelineRunService from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { type ComponentSpec, isGraphImplementation } from "./componentSpec";
import { submitPipelineRun } from "./submitPipeline";

// Mock dependencies
vi.mock("@/services/pipelineRunService", () => ({
  createPipelineRun: vi.fn(),
  savePipelineRun: vi.fn(),
}));

describe("submitPipelineRun", () => {
  const mockBackendUrl = "https://api.example.com";
  const mockAuthToken = "test-auth-token";

  let mockFetch: ReturnType<typeof vi.fn>;

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
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {},
          },
        },
        mockBackendUrl,
        mockAuthToken,
      );
      expect(pipelineRunService.savePipelineRun).toHaveBeenCalledWith(
        mockPipelineRun,
        "simple-component",
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
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: { param1: "value1", param2: "value2" },
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
      );
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
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              inputA: "valueA",
              inputB: "valueB",
            },
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
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              sharedKey: "fromTaskValue",
              uniqueInputKey: "inputOnlyValue",
              uniqueTaskKey: "taskOnlyValue",
            },
          },
        },
        mockBackendUrl,
        undefined,
      );
    });

    it("should filter out non-string taskArguments values", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "filter-args-component",
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

      // Assert - only string values should be included
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              stringArg: "validString",
              objectArg: undefined,
              numberArg: undefined,
            },
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
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: {
              inputArg: "inputValue",
            },
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
  });
});

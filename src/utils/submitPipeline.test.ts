import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as getArgumentsFromInputs from "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs";
import * as pipelineRunService from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { type ComponentSpec, isGraphImplementation } from "./componentSpec";
import { submitPipelineRun } from "./submitPipeline";

// Mock dependencies
vi.mock("@/services/pipelineRunService", () => ({
  createPipelineRun: vi.fn(),
  savePipelineRun: vi.fn(),
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs",
  () => ({
    getArgumentsFromInputs: vi.fn(),
  }),
);

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
    vi.mocked(getArgumentsFromInputs.getArgumentsFromInputs).mockReturnValue(
      {},
    );
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

    it("should include arguments when getArgumentsFromInputs returns data", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-with-args",
        implementation: { container: { image: "test:latest" } },
      };

      const mockArguments = { param1: "value1", param2: "value2" };
      vi.mocked(getArgumentsFromInputs.getArgumentsFromInputs).mockReturnValue(
        mockArguments,
      );

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      expect(pipelineRunService.createPipelineRun).toHaveBeenCalledWith(
        {
          root_task: {
            componentRef: {
              spec: componentSpec,
            },
            arguments: mockArguments,
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

  describe("input normalization", () => {
    it("should normalize inputs by copying default to value when value is missing", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-with-defaults",
        inputs: [
          {
            name: "input1",
            default: "default-value-1",
          },
          {
            name: "input2",
            value: "explicit-value",
            default: "default-value-2",
          },
          {
            name: "input3",
            default: "default-value-3",
          },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      const submittedSpec = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0][0].root_task.componentRef.spec;
      expect(submittedSpec).toBeDefined();
      if (submittedSpec?.inputs) {
        expect((submittedSpec.inputs[0] as any)?.value).toBe("default-value-1");
        expect((submittedSpec.inputs[1] as any)?.value).toBe("explicit-value");
        expect((submittedSpec.inputs[2] as any)?.value).toBe("default-value-3");
      }
    });

    it("should recursively normalize inputs in nested subgraphs", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-with-nested-defaults",
        inputs: [
          {
            name: "root-input",
            default: "root-default",
          },
        ],
        implementation: {
          graph: {
            tasks: {
              "nested-task": {
                componentRef: {
                  spec: {
                    name: "nested-component",
                    inputs: [
                      {
                        name: "nested-input",
                        default: "nested-default",
                      },
                    ],
                    implementation: { container: { image: "nested:latest" } },
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
      const submittedSpec = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0][0].root_task.componentRef.spec;
      expect(submittedSpec).toBeDefined();
      if (submittedSpec?.inputs) {
        expect((submittedSpec.inputs[0] as any)?.value).toBe("root-default");
      }
      if (
        submittedSpec?.implementation &&
        isGraphImplementation(submittedSpec.implementation as any)
      ) {
        const nestedSpec = (submittedSpec.implementation as any).graph.tasks[
          "nested-task"
        ].componentRef.spec;
        if (nestedSpec?.inputs) {
          expect((nestedSpec.inputs[0] as any)?.value).toBe("nested-default");
        }
      }
    });

    it("should not overwrite existing values with defaults", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-with-existing-values",
        inputs: [
          {
            name: "input1",
            value: "existing-value",
            default: "default-value",
          },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      const submittedSpec = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0][0].root_task.componentRef.spec;
      expect(submittedSpec).toBeDefined();
      if (submittedSpec?.inputs) {
        expect((submittedSpec.inputs[0] as any)?.value).toBe("existing-value");
      }
    });

    it("should handle inputs without defaults", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "component-without-defaults",
        inputs: [
          {
            name: "input1",
          },
          {
            name: "input2",
            value: "some-value",
          },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert
      const submittedSpec = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0][0].root_task.componentRef.spec;
      expect(submittedSpec).toBeDefined();
      if (submittedSpec?.inputs) {
        expect((submittedSpec.inputs[0] as any)?.value).toBeUndefined();
        expect((submittedSpec.inputs[1] as any)?.value).toBe("some-value");
      }
    });

    it("should not mutate the original component spec during normalization", async () => {
      // Arrange
      const componentSpec: ComponentSpec = {
        name: "immutable-test",
        inputs: [
          {
            name: "input1",
            default: "default-value",
          },
        ],
        implementation: { container: { image: "test:latest" } },
      };

      const originalCopy = structuredClone(componentSpec);

      // Act
      await submitPipelineRun(componentSpec, mockBackendUrl);

      // Assert - original spec should remain unchanged
      expect(componentSpec).toEqual(originalCopy);
      if (componentSpec.inputs) {
        expect((componentSpec.inputs[0] as any)?.value).toBeUndefined();
      }

      // But submitted spec should have the normalized value
      const submittedSpec = vi.mocked(pipelineRunService.createPipelineRun).mock
        .calls[0][0].root_task.componentRef.spec;
      expect(submittedSpec).toBeDefined();
      if (submittedSpec?.inputs) {
        expect((submittedSpec.inputs[0] as any)?.value).toBe("default-value");
      }
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

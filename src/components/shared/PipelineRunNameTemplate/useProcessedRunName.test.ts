import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { useProcessedRunName } from "./useProcessedRunName";

// Mock the providers
vi.mock("@/providers/ComponentSpecProvider", () => ({
  useComponentSpec: vi.fn(),
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionDataOptional: vi.fn(),
}));

// Import mocked modules
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";

const mockedUseComponentSpec = vi.mocked(useComponentSpec);
const mockedUseExecutionDataOptional = vi.mocked(useExecutionDataOptional);

/**
 * Helper to create a mock return value for useComponentSpec.
 * Only the componentSpec property is used by useProcessedRunName.
 */
function mockComponentSpecContext(componentSpec: ComponentSpec) {
  return { componentSpec } as ReturnType<typeof useComponentSpec>;
}

/**
 * Helper to create a mock return value for useExecutionDataOptional.
 */
function mockExecutionDataContext(
  taskSpec: {
    arguments?: Record<string, unknown>;
    annotations?: Record<string, unknown> | null;
  } | null,
): ReturnType<typeof useExecutionDataOptional> {
  if (taskSpec === null) {
    return undefined;
  }
  return {
    rootDetails: {
      task_spec: taskSpec,
    },
  } as ReturnType<typeof useExecutionDataOptional>;
}

const createMinimalComponentSpec = (
  overrides: Partial<ComponentSpec> = {},
): ComponentSpec => ({
  name: "test-component",
  implementation: {
    container: { image: "test-image", command: ["echo"] },
  },
  ...overrides,
});

describe("useProcessedRunName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("argument placeholders", () => {
    it("should resolve argument from execution data task arguments", () => {
      mockedUseComponentSpec.mockReturnValue(
        mockComponentSpecContext(
          createMinimalComponentSpec({
            inputs: [{ name: "Dataset Path" }],
            metadata: {
              annotations: {
                "run-name-template": "Training on ${arguments.Dataset Path}",
              },
            },
          }),
        ),
      );
      mockedUseExecutionDataOptional.mockReturnValue(
        mockExecutionDataContext({
          arguments: {
            "Dataset Path": "/data/train.csv",
          },
        }),
      );

      const { result } = renderHook(() => useProcessedRunName());

      expect(result.current).toBe("Training on /data/train.csv");
    });
  });

  describe("annotation placeholders", () => {
    it("should resolve annotation from task spec", () => {
      mockedUseComponentSpec.mockReturnValue(
        mockComponentSpecContext(
          createMinimalComponentSpec({
            metadata: {
              annotations: {
                "run-name-template": "Run by ${annotations.author}",
              },
            },
          }),
        ),
      );
      mockedUseExecutionDataOptional.mockReturnValue(
        mockExecutionDataContext({
          annotations: {
            author: "John Doe",
          },
        }),
      );

      const { result } = renderHook(() => useProcessedRunName());

      expect(result.current).toBe("Run by John Doe");
    });

    it("should convert non-string annotation values to string", () => {
      mockedUseComponentSpec.mockReturnValue(
        mockComponentSpecContext(
          createMinimalComponentSpec({
            metadata: {
              annotations: {
                "run-name-template": "Version ${annotations.version}",
              },
            },
          }),
        ),
      );
      mockedUseExecutionDataOptional.mockReturnValue(
        mockExecutionDataContext({
          annotations: {
            version: 42,
          },
        }),
      );

      const { result } = renderHook(() => useProcessedRunName());

      expect(result.current).toBe("Version 42");
    });
  });
});

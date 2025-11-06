import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/dom";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
} from "@/api/types.gen";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { useExecutionStatusQuery } from "@/hooks/useExecutionStatusQuery";
import { usePipelineRunData } from "@/hooks/usePipelineRunData";
import { useBackend } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import { PipelineRunsProvider } from "@/providers/PipelineRunsProvider";
import * as pipelineRunService from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";

import { RunDetails } from "./RunDetails";

// Mock the hooks and services
vi.mock("@tanstack/react-router", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useNavigate: () => vi.fn(),
    useLocation: () => ({
      pathname: "/runs/test-run-id-123",
      search: {},
      hash: "",
      href: "/runs/test-run-id-123",
      state: {},
    }),
  };
});
vi.mock("@/hooks/useExecutionStatusQuery");
vi.mock("@/hooks/useCheckComponentSpecFromPath");
vi.mock("@/hooks/usePipelineRunData");
vi.mock("@/services/pipelineRunService");
vi.mock("@/providers/BackendProvider");

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: vi.fn(() => ({
    data: {
      id: "test-user",
      permissions: ["read", "write"],
    },
  })),
}));

describe("<RunDetails/>", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const mockExecutionDetails: GetExecutionInfoResponse = {
    id: "test-execution-id",
    pipeline_run_id: "test-run-id-123",
    task_spec: {
      componentRef: {
        spec: {
          name: "Test Pipeline",
          description: "Test pipeline description",
          metadata: {
            annotations: {
              "test-annotation": "test-value",
            },
          },
          inputs: [],
          outputs: [],
        },
      },
    },
    child_task_execution_ids: {
      task1: "execution1",
      task2: "execution2",
    },
  };

  const mockRunningExecutionState: GetGraphExecutionStateResponse = {
    child_execution_status_stats: {
      execution1: { SUCCEEDED: 1 },
      execution2: { RUNNING: 1 },
    },
  };

  const mockCancelledExecutionState: GetGraphExecutionStateResponse = {
    child_execution_status_stats: {
      execution1: { SUCCEEDED: 1 },
      execution2: { CANCELLED: 1 },
    },
  };

  const mockComponentSpec: ComponentSpec = {
    name: "Test Pipeline",
    description: "Test pipeline description",
    metadata: {
      annotations: {
        "test-annotation": "test-value",
      },
    },
    inputs: [],
    outputs: [],
    implementation: {
      container: {
        image: "test-image",
        command: ["test-command"],
        args: ["test-arg"],
      },
    },
  };

  const mockPipelineRun: PipelineRun = {
    id: 123,
    root_execution_id: 456,
    created_by: "test-user",
    created_at: "2024-01-01T00:00:00Z",
    pipeline_name: "Test Pipeline",
    status: "RUNNING",
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    vi.mocked(useExecutionStatusQuery).mockReturnValue({
      data: "RUNNING",
      isLoading: false,
      error: null,
    } as any);

    // Mock pipelineRunService
    vi.mocked(pipelineRunService.fetchPipelineRunById).mockResolvedValue(
      mockPipelineRun,
    );

    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: true,
      ready: true,
      backendUrl: "http://localhost:8000",
      isConfiguredFromEnv: false,
      isConfiguredFromRelativePath: false,
      setEnvConfig: vi.fn(),
      setRelativePathConfig: vi.fn(),
      setBackendUrl: vi.fn(),
      ping: vi.fn(),
    });

    vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    return new Promise((resolve) => setTimeout(resolve, 0));
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(component, {
      wrapper: ({ children }) => (
        <ComponentSpecProvider spec={mockComponentSpec}>
          <QueryClientProvider client={queryClient}>
            <PipelineRunsProvider pipelineName={mockPipelineRun.pipeline_name}>
              <ExecutionDataProvider
                pipelineRunId={mockPipelineRun.id.toString()}
              >
                {children}
              </ExecutionDataProvider>
            </PipelineRunsProvider>
          </QueryClientProvider>
        </ComponentSpecProvider>
      ),
    });
  };

  describe("Inspect Pipeline Button", () => {
    test("should render inspect button when pipeline exists", async () => {
      // arrange
      vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(true);

      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockRunningExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const inspect = screen.getByTestId("inspect-pipeline-button");
      expect(inspect).toBeInTheDocument();
    });

    test("should NOT render inspect button when pipeline does not exist", async () => {
      // arrange
      vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(false);

      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockRunningExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const inspect = screen.queryByTestId("inspect-pipeline-button");
      expect(inspect).not.toBeInTheDocument();
    });
  });

  describe("Clone Pipeline Button", () => {
    test("should render clone button", async () => {
      // arrange
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockRunningExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const cloneButton = screen.getByTestId("clone-pipeline-run-button");
      expect(cloneButton).toBeInTheDocument();
    });
  });

  describe("Cancel Pipeline Run Button", () => {
    test("should render cancel button when status is RUNNING and user is the creator of the run", async () => {
      // arrange
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockRunningExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const cancelButton = screen.getByTestId("cancel-pipeline-run-button");
      expect(cancelButton).toBeInTheDocument();
    });

    test("should NOT render cancel button when status is not RUNNING", async () => {
      // arrange
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockCancelledExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const cancelButton = screen.queryByTestId("cancel-pipeline-run-button");
      expect(cancelButton).not.toBeInTheDocument();
    });

    test("should NOT render cancel button when the user is not the creator of the run", async () => {
      // arrange
      const pipelineRunWithDifferentCreator = {
        ...mockPipelineRun,
        created_by: "different-user",
      };

      vi.mocked(pipelineRunService.fetchPipelineRunById).mockResolvedValue(
        pipelineRunWithDifferentCreator,
      );

      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockRunningExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const cancelButton = screen.queryByTestId("cancel-pipeline-run-button");
      expect(cancelButton).not.toBeInTheDocument();
    });
  });

  describe("Rerun Pipeline Run Button", () => {
    test("should render rerun button when status is CANCELLED", async () => {
      // arrange
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockCancelledExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const rerunButton = screen.getByTestId("rerun-pipeline-button");
      expect(rerunButton).toBeInTheDocument();
    });

    test("should NOT render rerun button when status is RUNNING", async () => {
      // arrange
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockRunningExecutionState,
        },
        rootExecutionId: "test-execution-id",
        isLoading: false,
        error: null,
      });

      // act
      await act(async () => renderWithQueryClient(<RunDetails />));

      // assert
      const rerunButton = screen.queryByTestId("rerun-pipeline-button");
      expect(rerunButton).not.toBeInTheDocument();
    });
  });
});

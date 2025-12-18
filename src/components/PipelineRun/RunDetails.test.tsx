import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import { useCheckComponentSpecFromPath } from "@/hooks/useCheckComponentSpecFromPath";
import { usePipelineRunData } from "@/hooks/usePipelineRunData";
import { useBackend } from "@/providers/BackendProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import * as executionService from "@/services/executionService";
import type { ComponentSpec } from "@/utils/componentSpec";

import { RunDetails } from "./RunDetails";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { ReactFlowProvider } from "@xyflow/react";

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

vi.mock("@/hooks/useCheckComponentSpecFromPath");
vi.mock("@/services/executionService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/executionService")>();
  return {
    ...actual,
    countTaskStatuses: vi.fn(),
    getRunStatus: vi.fn(),
    isStatusInProgress: vi.fn(),
    isStatusComplete: vi.fn(),
  };
});
vi.mock("@/providers/BackendProvider");
vi.mock("@/hooks/usePipelineRunData");

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
    pipeline_run_id: "123",
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

  const mockExecutionState: GetGraphExecutionStateResponse = {
    child_execution_status_stats: {
      execution1: { SUCCEEDED: 1 },
      execution2: { RUNNING: 1 },
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

  const mockPipelineRun: PipelineRunResponse = {
    id: "123",
    root_execution_id: "456",
    created_by: "test-user",
    created_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    vi.mocked(usePipelineRunData).mockReturnValue({
      executionData: {
        details: mockExecutionDetails,
        state: mockExecutionState,
      },
      rootExecutionId: "456",
      isLoading: false,
      error: null,
    });

    queryClient.setQueryData(["pipeline-run-metadata", "123"], mockPipelineRun);

    vi.mocked(executionService.countTaskStatuses).mockReturnValue({
      total: 2,
      succeeded: 1,
      failed: 0,
      running: 1,
      waiting: 0,
      skipped: 0,
      cancelled: 0,
    });

    vi.mocked(executionService.getRunStatus).mockReturnValue("RUNNING");

    vi.mocked(executionService.isStatusInProgress).mockReturnValue(true);

    vi.mocked(executionService.isStatusComplete).mockReturnValue(false);

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
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(component, {
      wrapper: ({ children }) => (
        <ComponentSpecProvider spec={mockComponentSpec}>
          <QueryClientProvider client={queryClient}>
            <ExecutionDataProvider pipelineRunId="123">
              <ReactFlowProvider>
                <ContextPanelProvider>{children}</ContextPanelProvider>
              </ReactFlowProvider>
            </ExecutionDataProvider>
          </QueryClientProvider>
        </ComponentSpecProvider>
      ),
    });
  };

  describe("Inspect Pipeline Button", () => {
    test("should render inspect button when pipeline exists", async () => {
      // arrange
      vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(true);

      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const inspect = screen.getByTestId("inspect-pipeline-button");
        expect(inspect).toBeInTheDocument();
      });
    });

    test("should NOT render inspect button when pipeline does not exist", async () => {
      // arrange
      vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(false);

      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const inspect = screen.queryByTestId("inspect-pipeline-button");
        expect(inspect).not.toBeInTheDocument();
      });
    });
  });

  describe("Clone Pipeline Button", () => {
    test("should render clone button", async () => {
      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const cloneButton = screen.getByTestId("clone-pipeline-run-button");
        expect(cloneButton).toBeInTheDocument();
      });
    });
  });

  describe("Cancel Pipeline Run Button", () => {
    test("should render cancel button when status is RUNNING and user is the creator of the run", async () => {
      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const cancelButton = screen.getByTestId("cancel-pipeline-run-button");
        expect(cancelButton).toBeInTheDocument();
      });
    });

    test("should NOT render cancel button when status is not RUNNING", async () => {
      // arrange
      vi.mocked(executionService.countTaskStatuses).mockReturnValue({
        total: 2,
        succeeded: 1,
        failed: 0,
        running: 0,
        waiting: 0,
        skipped: 0,
        cancelled: 1,
      });

      vi.mocked(executionService.getRunStatus).mockReturnValue("CANCELLED");
      vi.mocked(executionService.isStatusInProgress).mockReturnValue(false);
      vi.mocked(executionService.isStatusComplete).mockReturnValue(true);

      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const cancelButton = screen.queryByTestId("cancel-pipeline-run-button");
        expect(cancelButton).not.toBeInTheDocument();
      });
    });

    test("should NOT render cancel button when the user is not the creator of the run", async () => {
      // arrange
      const pipelineRunWithDifferentCreator = {
        ...mockPipelineRun,
        created_by: "different-user",
      };

      queryClient.setQueryData(
        ["pipeline-run-metadata", "123"],
        pipelineRunWithDifferentCreator,
      );

      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const cancelButton = screen.queryByTestId("cancel-pipeline-run-button");
        expect(cancelButton).not.toBeInTheDocument();
      });
    });
  });

  describe("Rerun Pipeline Run Button", () => {
    test("should render rerun button when status is CANCELLED", async () => {
      // arrange
      vi.mocked(executionService.countTaskStatuses).mockReturnValue({
        total: 2,
        succeeded: 1,
        failed: 0,
        running: 0,
        waiting: 0,
        skipped: 0,
        cancelled: 1,
      });

      vi.mocked(executionService.getRunStatus).mockReturnValue("CANCELLED");
      vi.mocked(executionService.isStatusInProgress).mockReturnValue(false);
      vi.mocked(executionService.isStatusComplete).mockReturnValue(true);

      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const rerunButton = screen.getByTestId("rerun-pipeline-button");
        expect(rerunButton).toBeInTheDocument();
      });
    });

    test("should NOT render rerun button when status is RUNNING", async () => {
      // act
      renderWithProviders(<RunDetails />);

      // assert
      await waitFor(() => {
        const rerunButton = screen.queryByTestId("rerun-pipeline-button");
        expect(rerunButton).not.toBeInTheDocument();
      });
    });
  });
});

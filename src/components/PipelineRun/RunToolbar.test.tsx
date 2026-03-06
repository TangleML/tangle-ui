import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/dom";
import { cleanup, render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
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
import type { ComponentSpec } from "@/utils/componentSpec";

import { RunToolbar } from "./RunToolbar";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/useCheckComponentSpecFromPath");
vi.mock("@/hooks/usePipelineRunData");
vi.mock("@/providers/BackendProvider");

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: vi.fn(() => ({
    data: {
      id: "test-user",
      permissions: ["read", "write"],
    },
  })),
}));

describe("<RunToolbar/>", () => {
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
    summary: { total_nodes: 2, ended_nodes: 1, has_ended: false },
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
              <ReactFlowProvider>{children}</ReactFlowProvider>
            </ExecutionDataProvider>
          </QueryClientProvider>
        </ComponentSpecProvider>
      ),
    });
  };

  describe("Inspect Pipeline Button", () => {
    test("should render inspect button when pipeline exists", async () => {
      vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(true);

      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const inspect = screen.getByTestId("inspect-pipeline-button");
        expect(inspect).toBeInTheDocument();
      });
    });

    test("should NOT render inspect button when pipeline does not exist", async () => {
      vi.mocked(useCheckComponentSpecFromPath).mockReturnValue(false);

      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const inspect = screen.queryByTestId("inspect-pipeline-button");
        expect(inspect).not.toBeInTheDocument();
      });
    });
  });

  describe("Clone Pipeline Button", () => {
    test("should render clone button", async () => {
      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const cloneButton = screen.getByTestId("clone-pipeline-run-button");
        expect(cloneButton).toBeInTheDocument();
      });
    });
  });

  describe("Cancel Pipeline Run Button", () => {
    test("should render cancel button when status is RUNNING and user is the creator of the run", async () => {
      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const cancelButton = screen.getByTestId("cancel-pipeline-run-button");
        expect(cancelButton).toBeInTheDocument();
      });
    });

    test("should NOT render cancel button when status is not RUNNING", async () => {
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: {
            child_execution_status_stats: {
              execution1: { SUCCEEDED: 1 },
              execution2: { CANCELLED: 1 },
            },
            summary: { total_nodes: 2, ended_nodes: 2, has_ended: true },
          },
        },
        rootExecutionId: "456",
        isLoading: false,
        error: null,
      });

      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const cancelButton = screen.queryByTestId("cancel-pipeline-run-button");
        expect(cancelButton).not.toBeInTheDocument();
      });
    });

    test("should NOT render cancel button when the user is not the creator of the run", async () => {
      const pipelineRunWithDifferentCreator = {
        ...mockPipelineRun,
        created_by: "different-user",
      };

      queryClient.setQueryData(
        ["pipeline-run-metadata", "123"],
        pipelineRunWithDifferentCreator,
      );

      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const cancelButton = screen.queryByTestId("cancel-pipeline-run-button");
        expect(cancelButton).not.toBeInTheDocument();
      });
    });
  });

  describe("Rerun Pipeline Run Button", () => {
    test("should render rerun button when status is CANCELLED", async () => {
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: {
            child_execution_status_stats: {
              execution1: { SUCCEEDED: 1 },
              execution2: { CANCELLED: 1 },
            },
            summary: { total_nodes: 2, ended_nodes: 2, has_ended: true },
          },
        },
        rootExecutionId: "456",
        isLoading: false,
        error: null,
      });

      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const rerunButton = screen.getByTestId("rerun-pipeline-button");
        expect(rerunButton).toBeInTheDocument();
      });
    });

    test("should NOT render rerun button when status is RUNNING", async () => {
      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const rerunButton = screen.queryByTestId("rerun-pipeline-button");
        expect(rerunButton).not.toBeInTheDocument();
      });
    });
  });

  describe("View YAML Button", () => {
    test("should always render view yaml button", async () => {
      renderWithProviders(<RunToolbar />);

      await waitFor(() => {
        const viewYamlButton = screen.getByTestId("action-View");
        expect(viewYamlButton).toBeInTheDocument();
      });
    });
  });
});

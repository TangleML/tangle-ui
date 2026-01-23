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
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
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

vi.mock("@/hooks/useCheckComponentSpecFromPath");
vi.mock("@/services/executionService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/executionService")>();
  return {
    ...actual,
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

  describe("Run Details Content", () => {
    test("should render pipeline name", async () => {
      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(screen.getByText("Test Pipeline")).toBeInTheDocument();
      });
    });

    test("should render run metadata", async () => {
      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(screen.getByText("Run Info")).toBeInTheDocument();
        expect(screen.getByText("123")).toBeInTheDocument();
        expect(screen.getByText("456")).toBeInTheDocument();
        expect(screen.getByText("test-user")).toBeInTheDocument();
      });
    });

    test("should render description", async () => {
      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(
          screen.getByText("Test pipeline description"),
        ).toBeInTheDocument();
      });
    });

    test("should render status", async () => {
      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(screen.getByText("Status")).toBeInTheDocument();
      });
    });

    test("should render annotations", async () => {
      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(screen.getByText("Annotations")).toBeInTheDocument();
        expect(screen.getByText("test-annotation")).toBeInTheDocument();
        expect(screen.getByText("test-value")).toBeInTheDocument();
      });
    });
  });

  describe("Error States", () => {
    test("should show error message when execution details fail to load", async () => {
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: undefined,
          state: mockExecutionState,
        },
        rootExecutionId: "456",
        isLoading: false,
        error: new Error("Failed to load"),
      });

      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(
          screen.getByText("Pipeline Run could not be loaded."),
        ).toBeInTheDocument();
      });
    });

    test("should show loading screen when data is loading", async () => {
      vi.mocked(usePipelineRunData).mockReturnValue({
        executionData: {
          details: mockExecutionDetails,
          state: mockExecutionState,
        },
        rootExecutionId: "456",
        isLoading: true,
        error: null,
      });

      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(screen.getByText("Loading run details...")).toBeInTheDocument();
      });
    });

    test("should show backend not configured message when backend is not configured", async () => {
      vi.mocked(useBackend).mockReturnValue({
        configured: false,
        available: false,
        ready: false,
        backendUrl: "",
        isConfiguredFromEnv: false,
        isConfiguredFromRelativePath: false,
        setEnvConfig: vi.fn(),
        setRelativePathConfig: vi.fn(),
        setBackendUrl: vi.fn(),
        ping: vi.fn(),
      });

      renderWithProviders(<RunDetails />);

      await waitFor(() => {
        expect(
          screen.getByText("Configure a backend to view execution artifacts."),
        ).toBeInTheDocument();
      });
    });
  });
});

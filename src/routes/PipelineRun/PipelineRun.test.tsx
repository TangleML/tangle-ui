import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type {
  ComponentSpecOutput,
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
} from "@/api/types.gen";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";

import PipelineRun from "./PipelineRun";

// Mock the router and other dependencies
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
    useMatch: () => ({
      params: { id: "test-run-id-123" },
    }),
  };
});

vi.mock("@/routes/router", () => ({
  runDetailRoute: {
    useParams: () => ({ id: "test-run-id-123" }),
  },
  RUNS_BASE_PATH: "/runs",
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "http://localhost:8000",
    configured: true,
    available: true,
    ready: true,
    isConfiguredFromEnv: false,
    isConfiguredFromRelativePath: false,
    setEnvConfig: vi.fn(),
    setRelativePathConfig: vi.fn(),
    setBackendUrl: vi.fn(),
    ping: vi.fn(),
  }),
}));

vi.mock("@/services/executionService", () => ({
  useFetchExecutionInfo: vi.fn(),
  useFetchPipelineRun: () => ({
    data: null,
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: () => {},
    enabled: false,
  }),
  countTaskStatuses: vi.fn(),
  getRunStatus: vi.fn(),
  STATUS: {
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
    RUNNING: "RUNNING",
    WAITING: "WAITING",
    CANCELLED: "CANCELLED",
    UNKNOWN: "UNKNOWN",
  },
}));

const mockUsePipelineRunData = vi.fn();
vi.mock("@/hooks/usePipelineRunData", () => ({
  usePipelineRunData: () => mockUsePipelineRunData(),
}));

const mockUseComponentSpec = vi.fn();
vi.mock("@/providers/ComponentSpecProvider", async (importOriginal) => {
  const actual = (await importOriginal()) as object;
  return {
    ...actual,
    useComponentSpec: () => mockUseComponentSpec(),
  };
});

vi.mock("@/hooks/useDocumentTitle", () => ({
  useDocumentTitle: () => {},
}));

vi.mock("@/hooks/useFavicon", () => ({
  useFavicon: () => {},
}));

describe("<PipelineRun/>", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const mockComponentSpec: ComponentSpecOutput = {
    name: "Test Pipeline",
    description: "Test pipeline description",
    inputs: [],
    outputs: [],
    metadata: {
      annotations: undefined,
    },
    implementation: {
      graph: {
        tasks: {
          "task-1": {
            componentRef: {
              spec: {
                name: "Task 1",
                inputs: [],
                outputs: [],
                metadata: {
                  annotations: undefined,
                },
                implementation: {
                  container: {
                    image: "test-image",
                    command: ["test-command"],
                  },
                },
              },
            },
          },
          "task-2": {
            componentRef: {
              spec: {
                name: "Task 2",
                inputs: [],
                outputs: [],
                metadata: {
                  annotations: undefined,
                },
                implementation: {
                  container: {
                    image: "test-image-2",
                    command: ["test-command-2"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const mockExecutionDetails: GetExecutionInfoResponse = {
    id: "test-execution-id",
    pipeline_run_id: "test-run-id-123",
    task_spec: {
      componentRef: {
        spec: mockComponentSpec,
      },
    },
    child_task_execution_ids: {
      "task-1": "execution-1",
      "task-2": "execution-2",
    },
  };

  const mockExecutionState: GetGraphExecutionStateResponse = {
    child_execution_status_stats: {
      "execution-1": { SUCCEEDED: 1 },
      "execution-2": { RUNNING: 1 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsePipelineRunData.mockReturnValue({
      executionData: {
        details: mockExecutionDetails,
        state: mockExecutionState,
      },
      rootExecutionId: "test-execution-id",
      isLoading: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  test("should render loading state initially", async () => {
    // arrange
    mockUseComponentSpec.mockReturnValue({
      componentSpec: null,
      setComponentSpec: vi.fn(),
      clearComponentSpec: vi.fn(),
      currentSubgraphPath: ["root"],
      navigateToSubgraph: vi.fn(),
      navigateBack: vi.fn(),
      navigateToPath: vi.fn(),
      canNavigateBack: false,
      graphSpec: {} as never,
      isLoading: false,
      isValid: true,
      errors: [],
      refetch: vi.fn(),
      updateGraphSpec: vi.fn(),
      saveComponentSpec: vi.fn(),
      undoRedo: {} as never,
    });

    mockUsePipelineRunData.mockReturnValue({
      executionData: {
        details: mockExecutionDetails,
        state: mockExecutionState,
      },
      rootExecutionId: "test-execution-id",
      isLoading: true,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    // act
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ComponentSpecProvider spec={undefined}>
          <PipelineRun />
        </ComponentSpecProvider>
      </QueryClientProvider>,
    );

    // assert
    expect(getByText("Loading Pipeline Run...")).toBeInTheDocument();
  });
});

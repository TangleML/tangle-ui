import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useRerunPipelineRun } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";
import type { ComponentSpec } from "@/utils/componentSpec";
import {
  SAVED_PIPELINE_ID_ANNOTATION,
  SOURCE_PIPELINE_ID_ANNOTATION,
} from "@/utils/pipelineRunSource";

import { RerunPipelineButton } from "./RerunPipelineButton";

const {
  navigateMock,
  notifyMock,
  mockSubmitPipelineRun,
  mockIsAuthorizationRequired,
  mockAwaitAuthorization,
  mockIsAuthorized,
  mockGetToken,
  mockFetch,
  mockUseExecutionDataOptional,
  mockFetchRunAnnotations,
  remotePipelines,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  notifyMock: vi.fn(),
  mockSubmitPipelineRun: vi.fn(),
  mockIsAuthorizationRequired: vi.fn(),
  mockAwaitAuthorization: vi.fn(),
  mockIsAuthorized: vi.fn(),
  mockGetToken: vi.fn(),
  mockFetch: vi.fn(),
  mockUseExecutionDataOptional: vi.fn(),
  mockFetchRunAnnotations: vi.fn(),
  remotePipelines: { enabled: true },
}));

// Set up mocks
global.fetch = mockFetch;

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notifyMock,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

vi.mock("@/routes/router", () => import("@/routes/appRoutes"));

vi.mock("@/components/shared/Authentication/helpers", () => ({
  isAuthorizationRequired: mockIsAuthorizationRequired,
}));
vi.mock("@/components/shared/Authentication/useAwaitAuthorization", () => ({
  useAwaitAuthorization: () => ({
    awaitAuthorization: mockAwaitAuthorization,
    get isAuthorized() {
      return mockIsAuthorized();
    },
  }),
}));

vi.mock("@/components/shared/Authentication/useAuthLocalStorage", () => ({
  useAuthLocalStorage: () => ({
    getToken: mockGetToken,
  }),
}));

vi.mock("@/utils/submitPipeline", () => ({
  submitPipelineRun: mockSubmitPipelineRun,
}));

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionDataOptional: mockUseExecutionDataOptional,
  useExecutionData: mockUseExecutionDataOptional,
}));

vi.mock("@/services/pipelineRunService", () => ({
  fetchRunAnnotations: mockFetchRunAnnotations,
}));

vi.mock("@/utils/remotePipelines", () => ({
  get REMOTE_PIPELINES_ENABLED() {
    return remotePipelines.enabled;
  },
}));

const testOrigin = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

Object.defineProperty(window, "location", {
  value: {
    origin: testOrigin,
  },
  writable: true,
});

function RerunHookHarness({ componentSpec }: { componentSpec: ComponentSpec }) {
  const { rerun, isRerunning } = useRerunPipelineRun(componentSpec);
  return (
    <button
      data-testid="rerun-pipeline-button"
      onClick={rerun}
      disabled={isRerunning}
    >
      Rerun
    </button>
  );
}

describe("<RerunPipelineButton/>", () => {
  const componentSpec = { name: "Test Pipeline" } as any;
  let queryClient: QueryClient;

  const renderWithProviders = (ui: ReactElement) => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    );
  };

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    navigateMock.mockClear();
    notifyMock.mockClear();
    mockSubmitPipelineRun.mockClear();
    mockIsAuthorizationRequired.mockReturnValue(false);
    mockIsAuthorized.mockReturnValue(true);
    mockGetToken.mockReturnValue("mock-token");
    mockAwaitAuthorization.mockClear();
    mockUseExecutionDataOptional.mockReturnValue(undefined);
    mockFetchRunAnnotations.mockResolvedValue({});
    remotePipelines.enabled = true;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    cleanup();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  test("renders rerun button", async () => {
    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    expect(screen.getByTestId("rerun-pipeline-button")).toBeInTheDocument();
  });

  test("calls submitPipelineRun on click", async () => {
    mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
      onSuccess({ id: 123 });
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
        componentSpec,
        expect.any(String),
        expect.objectContaining({
          authorizationToken: "mock-token",
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  test("handles successful rerun", async () => {
    mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
      onSuccess({ id: 123 });
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/runs-v2/123",
      });
    });
  });

  test("handles rerun error", async () => {
    const testError = new Error("Test error");
    mockSubmitPipelineRun.mockImplementation(async (_, __, { onError }) => {
      onError(testError);
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        "Failed to submit pipeline. Test error",
        "error",
      );
    });
  });

  test("disables button while submitting", async () => {
    let resolveSubmit: (value: any) => void;
    const submitPromise = new Promise((resolve) => {
      resolveSubmit = resolve;
    });

    mockSubmitPipelineRun.mockImplementation(() => submitPromise);

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    // Wait for the mutation to start
    await waitFor(() => {
      expect(rerunButton).toBeDisabled();
    });

    await act(async () => {
      resolveSubmit!({ id: 123 });
    });
  });

  test("handles authorization when required and not authorized", async () => {
    mockIsAuthorizationRequired.mockReturnValue(true);
    mockIsAuthorized.mockReturnValue(false);
    mockAwaitAuthorization.mockResolvedValue("new-token");
    mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
      onSuccess({ id: 123 });
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(mockAwaitAuthorization).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
        componentSpec,
        expect.any(String),
        expect.objectContaining({
          authorizationToken: "new-token",
        }),
      );
    });
  });

  test("handles authorization failure", async () => {
    mockIsAuthorizationRequired.mockReturnValue(true);
    mockIsAuthorized.mockReturnValue(false);
    mockAwaitAuthorization.mockResolvedValue(null);
    mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
      onSuccess({ id: 123 });
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(mockAwaitAuthorization).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
        componentSpec,
        expect.any(String),
        expect.objectContaining({
          authorizationToken: "mock-token",
        }),
      );
    });
  });

  test("handles string error", async () => {
    const stringError = "String error message";
    mockSubmitPipelineRun.mockImplementation(async (_, __, { onError }) => {
      onError(stringError);
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(
        "Failed to submit pipeline. String error message",
        "error",
      );
    });
  });

  test("passes taskArguments from execution data to submitPipelineRun", async () => {
    const mockTaskArguments = {
      input_param: "test_value",
      another_param: "another_value",
    };

    mockUseExecutionDataOptional.mockReturnValue({
      rootDetails: {
        task_spec: {
          arguments: mockTaskArguments,
        },
      },
    });

    mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
      onSuccess({ id: 456 });
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
        componentSpec,
        expect.any(String),
        expect.objectContaining({
          taskArguments: mockTaskArguments,
          authorizationToken: "mock-token",
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  test("passes undefined taskArguments when execution data is not available", async () => {
    mockUseExecutionDataOptional.mockReturnValue(undefined);

    mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
      onSuccess({ id: 789 });
    });

    await act(async () => {
      renderWithProviders(
        <RerunPipelineButton componentSpec={componentSpec} />,
      );
    });

    const rerunButton = screen.getByTestId("rerun-pipeline-button");

    await act(async () => {
      fireEvent.click(rerunButton);
    });

    await waitFor(() => {
      expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
        componentSpec,
        expect.any(String),
        expect.objectContaining({
          taskArguments: undefined,
          authorizationToken: "mock-token",
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  describe.each(["V1", "V2"])("%s source association", (version) => {
    const backendUrl = "https://backend.example.com";
    const sourcePipelineId = "550e8400-e29b-41d4-a716-446655440000";
    const otherPipelineId = "550e8400-e29b-41d4-a716-446655440001";
    const taskArguments = { dataset: "original-dataset" };

    function renderRerun() {
      return renderWithProviders(
        version === "V1" ? (
          <RerunPipelineButton componentSpec={componentSpec} />
        ) : (
          <RerunHookHarness componentSpec={componentSpec} />
        ),
      );
    }

    beforeEach(() => {
      mockUseExecutionDataOptional.mockReturnValue({
        runId: "run-1",
        metadata: { id: "run-1" },
        rootDetails: { task_spec: { arguments: taskArguments } },
      });
      mockSubmitPipelineRun.mockImplementation(
        (_spec, _backend, { onSuccess }) => onSuccess({ id: "rerun-1" }),
      );
    });

    test.each([SAVED_PIPELINE_ID_ANNOTATION, SOURCE_PIPELINE_ID_ANNOTATION])(
      "preserves the pipeline ID from %s",
      async (annotationKey) => {
        mockFetchRunAnnotations.mockResolvedValue({
          [annotationKey]: sourcePipelineId,
        });
        renderRerun();

        fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

        await waitFor(() => expect(mockSubmitPipelineRun).toHaveBeenCalled());
        expect(mockSubmitPipelineRun.mock.calls[0][2].sourcePipelineId).toBe(
          sourcePipelineId,
        );
        expect(mockSubmitPipelineRun.mock.calls[0][0]).toBe(componentSpec);
        expect(mockSubmitPipelineRun.mock.calls[0][2].taskArguments).toBe(
          taskArguments,
        );
        expect(mockFetchRunAnnotations).toHaveBeenCalledExactlyOnceWith(
          "run-1",
          backendUrl,
        );
      },
    );

    test.each([undefined, "not-a-pipeline-id"])(
      "submits without an association for source ID %s",
      async (sourceId) => {
        mockFetchRunAnnotations.mockResolvedValue(
          sourceId === undefined
            ? {}
            : { [SOURCE_PIPELINE_ID_ANNOTATION]: sourceId },
        );
        renderRerun();

        fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

        await waitFor(() => expect(mockSubmitPipelineRun).toHaveBeenCalled());
        expect(
          mockSubmitPipelineRun.mock.calls[0][2].sourcePipelineId,
        ).toBeUndefined();
      },
    );

    test("does not reuse annotations from another backend or an unscoped cache", async () => {
      mockFetchRunAnnotations.mockResolvedValue({
        [SOURCE_PIPELINE_ID_ANNOTATION]: sourcePipelineId,
      });
      renderRerun();
      queryClient.setQueryData(
        ["pipeline-run-annotations", "https://other.example.com", "run-1"],
        { [SOURCE_PIPELINE_ID_ANNOTATION]: otherPipelineId },
      );
      queryClient.setQueryData(["pipeline-run-annotations", "run-1"], {
        [SOURCE_PIPELINE_ID_ANNOTATION]: otherPipelineId,
      });

      fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

      await waitFor(() => expect(mockSubmitPipelineRun).toHaveBeenCalled());
      expect(mockSubmitPipelineRun.mock.calls[0][2].sourcePipelineId).toBe(
        sourcePipelineId,
      );
      expect(mockFetchRunAnnotations).toHaveBeenCalledWith("run-1", backendUrl);
    });

    test("reuses the viewer's annotations and prefers the server association", async () => {
      renderRerun();
      queryClient.setQueryData(
        ["pipeline-run-annotations", backendUrl, "run-1"],
        {
          [SAVED_PIPELINE_ID_ANNOTATION]: sourcePipelineId,
          [SOURCE_PIPELINE_ID_ANNOTATION]: otherPipelineId,
        },
      );

      fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

      await waitFor(() => expect(mockSubmitPipelineRun).toHaveBeenCalled());
      expect(mockSubmitPipelineRun.mock.calls[0][2].sourcePipelineId).toBe(
        sourcePipelineId,
      );
      expect(mockFetchRunAnnotations).not.toHaveBeenCalled();
    });

    test("reports annotation failures before submitting", async () => {
      mockFetchRunAnnotations.mockRejectedValue(
        new Error("Annotations unavailable"),
      );
      renderRerun();

      fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

      await waitFor(() => {
        expect(notifyMock).toHaveBeenCalledWith(
          "Failed to submit pipeline. Annotations unavailable",
          "error",
        );
      });
      expect(mockSubmitPipelineRun).not.toHaveBeenCalled();
      expect(screen.getByTestId("rerun-pipeline-button")).toBeEnabled();
    });

    test("does not request annotations when remote pipelines are disabled", async () => {
      remotePipelines.enabled = false;
      renderRerun();
      queryClient.setQueryData(
        ["pipeline-run-annotations", backendUrl, "run-1"],
        { [SOURCE_PIPELINE_ID_ANNOTATION]: sourcePipelineId },
      );

      fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

      await waitFor(() => expect(mockSubmitPipelineRun).toHaveBeenCalled());
      expect(mockFetchRunAnnotations).not.toHaveBeenCalled();
      expect(
        mockSubmitPipelineRun.mock.calls[0][2].sourcePipelineId,
      ).toBeUndefined();
    });

    test("invalidates the current backend's run lists after submission", async () => {
      renderRerun();
      const currentRunsKey = ["runs", backendUrl, { sourcePipelineId }];
      const otherRunsKey = ["runs", "https://other.example.com"];
      queryClient.setQueryData(currentRunsKey, []);
      queryClient.setQueryData(otherRunsKey, []);

      fireEvent.click(screen.getByTestId("rerun-pipeline-button"));

      await waitFor(() => {
        expect(queryClient.getQueryState(currentRunsKey)?.isInvalidated).toBe(
          true,
        );
      });
      expect(queryClient.getQueryState(otherRunsKey)?.isInvalidated).toBe(
        false,
      );
      expect(navigateMock).toHaveBeenCalledWith({
        to: version === "V1" ? "/runs-v2/rerun-1" : "/runs/rerun-1",
      });
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { useRunActions } from "./useRunActions";

const {
  mockNotify,
  mockNavigate,
  mockAwaitAuthorization,
  mockGetToken,
  mockIsAuthorized,
  mockCopyRunToPipeline,
  mockCancelPipelineRun,
  mockSubmitPipelineRun,
  mockIsAuthorizationRequired,
} = vi.hoisted(() => ({
  mockNotify: vi.fn(),
  mockNavigate: vi.fn(),
  mockAwaitAuthorization: vi.fn(),
  mockGetToken: vi.fn(),
  mockIsAuthorized: vi.fn(),
  mockCopyRunToPipeline: vi.fn(),
  mockCancelPipelineRun: vi.fn(),
  mockSubmitPipelineRun: vi.fn(),
  mockIsAuthorizationRequired: vi.fn(),
}));

// Mock dependencies
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: () => ({
    data: { id: "user-123", permissions: [] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useCheckComponentSpecFromPath", () => ({
  useCheckComponentSpecFromPath: () => true,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
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
  }),
}));

vi.mock("@/services/pipelineRunService", () => ({
  copyRunToPipeline: mockCopyRunToPipeline,
  cancelPipelineRun: mockCancelPipelineRun,
}));

vi.mock("@/utils/submitPipeline", () => ({
  submitPipelineRun: mockSubmitPipelineRun,
}));

vi.mock("@/components/shared/Authentication/helpers", () => ({
  isAuthorizationRequired: mockIsAuthorizationRequired,
}));

vi.mock("@/components/shared/Authentication/useAwaitAuthorization", () => ({
  useAwaitAuthorization: () => ({
    awaitAuthorization: mockAwaitAuthorization,
    get isAuthorized() {
      return mockIsAuthorized();
    },
    isLoading: false,
    isPopupOpen: false,
    closePopup: vi.fn(),
    bringPopupToFront: vi.fn(),
  }),
}));

vi.mock("@/components/shared/Authentication/useAuthLocalStorage", () => ({
  useAuthLocalStorage: () => ({
    getToken: mockGetToken,
  }),
}));

describe("useRunActions", () => {
  let queryClient: QueryClient;

  const defaultParams = {
    componentSpec: { name: "Test Pipeline" } as ComponentSpec,
    runId: "test-run-123",
    createdBy: "user-123",
    statusCounts: {
      succeeded: 0,
      failed: 0,
      running: 1,
      waiting: 0,
      cancelled: 0,
      unknown: 0,
      skipped: 0,
      total: 1,
    },
  };

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      QueryClientProvider({ client: queryClient, children });
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
    mockIsAuthorizationRequired.mockReturnValue(false);
    mockIsAuthorized.mockReturnValue(true);
    mockGetToken.mockReturnValue("mock-token");
  });

  describe("Action array composition", () => {
    test("includes View YAML action", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const viewYamlAction = result.current.actions.find(
        (action) => action.label === "View YAML",
      );

      expect(viewYamlAction).toEqual({
        label: "View YAML",
        icon: "FileCodeCorner",
        onClick: expect.any(Function),
      });
    });

    test("includes Inspect Pipeline action", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const inspectAction = result.current.actions.find(
        (action) => action.label === "Inspect Pipeline",
      );

      expect(inspectAction).toMatchObject({
        label: "Inspect Pipeline",
        icon: "SquareMousePointer",
        hidden: false,
      });
    });

    test("includes Clone Pipeline action", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cloneAction = result.current.actions.find(
        (action) => action.label === "Clone Pipeline",
      );

      expect(cloneAction).toMatchObject({
        label: "Clone Pipeline",
        icon: "CopyPlus",
        disabled: false,
      });
    });

    test("shows Cancel Run action when run is in progress and user is creator", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cancelAction = result.current.actions.find(
        (action) => action.label === "Cancel Run",
      );

      expect(cancelAction).toMatchObject({
        label: "Cancel Run",
        icon: "CircleX",
        destructive: true,
        disabled: false,
        hidden: false,
        confirmation: expect.any(String),
      });
    });

    test("shows Rerun Pipeline action when run is complete", () => {
      const completeParams = {
        ...defaultParams,
        statusCounts: {
          succeeded: 1,
          failed: 0,
          running: 0,
          waiting: 0,
          cancelled: 0,
          unknown: 0,
          skipped: 0,
          total: 1,
        },
      };

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      expect(rerunAction).toMatchObject({
        label: "Rerun Pipeline",
        icon: "RefreshCcw",
        disabled: false,
        hidden: false,
      });
    });

    test("hides Rerun Pipeline action when run is in progress", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      expect(rerunAction?.hidden).toBe(true);
    });
  });

  describe("State management", () => {
    test("isYamlFullscreen starts as false", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      expect(result.current.isYamlFullscreen).toBe(false);
    });

    test("handleCloseYaml sets isYamlFullscreen to false", () => {
      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      result.current.handleCloseYaml();

      expect(result.current.isYamlFullscreen).toBe(false);
    });
  });

  describe("Clone Pipeline mutation", () => {
    test("calls copyRunToPipeline with correct arguments", async () => {
      mockCopyRunToPipeline.mockResolvedValue({
        url: "/editor/cloned-pipeline",
        name: "Cloned Pipeline",
      });

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cloneAction = result.current.actions.find(
        (action) => action.label === "Clone Pipeline",
      );

      cloneAction?.onClick();

      await waitFor(() => {
        expect(mockCopyRunToPipeline).toHaveBeenCalledWith(
          defaultParams.componentSpec,
          expect.any(String),
        );
      });
    });

    test("shows success notification on successful clone", async () => {
      mockCopyRunToPipeline.mockResolvedValue({
        url: "/editor/cloned-pipeline",
        name: "Cloned Pipeline",
      });

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cloneAction = result.current.actions.find(
        (action) => action.label === "Clone Pipeline",
      );

      cloneAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          'Pipeline "Cloned Pipeline" cloned',
          "success",
        );
      });
    });

    test("shows error notification on clone failure", async () => {
      const errorMessage = "Clone failed";
      mockCopyRunToPipeline.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cloneAction = result.current.actions.find(
        (action) => action.label === "Clone Pipeline",
      );

      cloneAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          expect.stringContaining("Error cloning pipeline"),
          "error",
        );
      });
    });

    test("disables action while mutation is pending", async () => {
      let resolveClone: (value: any) => void;
      const clonePromise = new Promise((resolve) => {
        resolveClone = resolve;
      });

      mockCopyRunToPipeline.mockReturnValue(clonePromise as any);

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cloneAction = result.current.actions.find(
        (action) => action.label === "Clone Pipeline",
      );

      cloneAction?.onClick();

      await waitFor(() => {
        const currentCloneAction = result.current.actions.find(
          (action) => action.label === "Clone Pipeline",
        );
        expect(currentCloneAction?.disabled).toBe(true);
      });

      resolveClone!({ url: "/editor/test", name: "Test" });
    });
  });

  describe("Cancel Pipeline Run mutation", () => {
    test("calls cancelPipelineRun with correct arguments", async () => {
      mockCancelPipelineRun.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cancelAction = result.current.actions.find(
        (action) => action.label === "Cancel Run",
      );

      cancelAction?.onClick();

      await waitFor(() => {
        expect(mockCancelPipelineRun).toHaveBeenCalledWith(
          "test-run-123",
          "http://localhost:8000",
        );
      });
    });

    test("shows success notification on successful cancellation", async () => {
      mockCancelPipelineRun.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cancelAction = result.current.actions.find(
        (action) => action.label === "Cancel Run",
      );

      cancelAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          "Pipeline run test-run-123 cancelled",
          "success",
        );
      });
    });

    test("shows error notification on cancellation failure", async () => {
      const errorMessage = "Network error";
      mockCancelPipelineRun.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cancelAction = result.current.actions.find(
        (action) => action.label === "Cancel Run",
      );

      cancelAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          expect.stringContaining("Error cancelling run"),
          "error",
        );
      });
    });

    test("shows warning when runId is null", async () => {
      const { result } = renderHook(
        () => useRunActions({ ...defaultParams, runId: null }),
        { wrapper: createWrapper() },
      );

      const cancelAction = result.current.actions.find(
        (action) => action.label === "Cancel Run",
      );

      cancelAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          "Failed to cancel run. No run ID found.",
          "warning",
        );
        expect(mockCancelPipelineRun).not.toHaveBeenCalled();
      });
    });

    test("changes to success state after cancellation", async () => {
      mockCancelPipelineRun.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRunActions(defaultParams), {
        wrapper: createWrapper(),
      });

      const cancelAction = result.current.actions.find(
        (action) => action.label === "Cancel Run",
      );

      cancelAction?.onClick();

      await waitFor(() => {
        const updatedCancelAction = result.current.actions.find(
          (action) => action.label === "Cancel Run",
        );
        expect(updatedCancelAction?.icon).toBe("CircleSlash");
        expect(updatedCancelAction?.destructive).toBe(false);
        expect(updatedCancelAction?.disabled).toBe(true);
      });
    });
  });

  describe("Rerun Pipeline mutation", () => {
    const completeParams = {
      ...defaultParams,
      statusCounts: {
        succeeded: 1,
        failed: 0,
        running: 0,
        waiting: 0,
        cancelled: 0,
        unknown: 0,
        skipped: 0,
        total: 1,
      },
    };

    test("calls submitPipelineRun with correct arguments", async () => {
      mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
        onSuccess({ id: "new-run-123" } as any);
      });

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      rerunAction?.onClick();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          completeParams.componentSpec,
          "http://localhost:8000",
          expect.objectContaining({
            authorizationToken: "mock-token",
          }),
        );
      });
    });

    test("navigates to new run on success", async () => {
      mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
        onSuccess({ id: "new-run-123" } as any);
      });

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      rerunAction?.onClick();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/runs/new-run-123" });
      });
    });

    test("shows error notification on rerun failure", async () => {
      const testError = new Error("Test error");
      mockSubmitPipelineRun.mockImplementation(async (_, __, { onError }) => {
        onError(testError);
      });

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      rerunAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          "Failed to submit pipeline. Test error",
          "error",
        );
      });
    });

    test("handles string error messages", async () => {
      const stringError = "String error message";
      mockSubmitPipelineRun.mockImplementation(async (_, __, { onError }) => {
        onError(stringError);
      });

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      rerunAction?.onClick();

      await waitFor(() => {
        expect(mockNotify).toHaveBeenCalledWith(
          "Failed to submit pipeline. String error message",
          "error",
        );
      });
    });

    test("awaits authorization when required", async () => {
      mockIsAuthorizationRequired.mockReturnValue(true);
      mockIsAuthorized.mockReturnValue(false);
      mockAwaitAuthorization.mockResolvedValue("new-token");

      mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
        onSuccess({ id: "new-run-123" } as any);
      });

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      rerunAction?.onClick();

      await waitFor(() => {
        expect(mockAwaitAuthorization).toHaveBeenCalled();
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          completeParams.componentSpec,
          "http://localhost:8000",
          expect.objectContaining({
            authorizationToken: "new-token",
          }),
        );
      });
    });

    test("falls back to getToken when authorization fails", async () => {
      mockIsAuthorizationRequired.mockReturnValue(true);
      mockIsAuthorized.mockReturnValue(false);
      mockAwaitAuthorization.mockResolvedValue(null);

      mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
        onSuccess({ id: "new-run-123" } as any);
      });

      const { result } = renderHook(() => useRunActions(completeParams), {
        wrapper: createWrapper(),
      });

      const rerunAction = result.current.actions.find(
        (action) => action.label === "Rerun Pipeline",
      );

      rerunAction?.onClick();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          completeParams.componentSpec,
          "http://localhost:8000",
          expect.objectContaining({
            authorizationToken: "mock-token",
          }),
        );
      });
    });
  });
});

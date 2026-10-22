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

import { useMissingSecrets } from "@/components/shared/SecretsManagement/useMissingSecrets";
import { BackendProvider } from "@/providers/BackendProvider";
import { useRunTeam } from "@/services/teams/useRunTeam";

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
}));

vi.mock("@/services/teams/useRunTeam", () => ({
  useRunTeam: vi.fn(),
}));

vi.mock("@/components/shared/SecretsManagement/useMissingSecrets", () => ({
  useMissingSecrets: vi.fn(),
}));

const ML_TEAM = { id: "ml-team@example.com", label: "ML Research" };

const testOrigin = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

Object.defineProperty(window, "location", {
  value: {
    origin: testOrigin,
  },
  writable: true,
});

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
      <QueryClientProvider client={queryClient}>
        <BackendProvider>{ui}</BackendProvider>
      </QueryClientProvider>,
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
    vi.mocked(useRunTeam).mockReturnValue({ status: "none" });
    vi.mocked(useMissingSecrets).mockReturnValue({
      missing: [],
      isChecking: false,
    });
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
        to: "/runs/123",
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

  describe("for a run filed under a team's project", () => {
    const rerunNow = async () => {
      await act(async () => {
        renderWithProviders(
          <RerunPipelineButton componentSpec={componentSpec} />,
        );
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("rerun-pipeline-button"));
      });
    };

    beforeEach(() => {
      mockSubmitPipelineRun.mockImplementation(async (_, __, { onSuccess }) => {
        onSuccess({ id: 123 });
      });
    });

    test("reruns as the team", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "active",
        team: { ...ML_TEAM, canWrite: true },
      });

      await rerunNow();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: ML_TEAM.id }),
        );
      });
    });

    test("asks before rerunning as you instead of the team", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "not-member",
        team: ML_TEAM,
      });

      await rerunNow();

      expect(
        screen.getByRole("alertdialog", { name: "Rerun this pipeline?" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Runs as you")).toBeInTheDocument();
      expect(mockSubmitPipelineRun).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      });

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: undefined }),
        );
      });
    });

    test("asks before rerunning without the secrets the run uses", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "active",
        team: { ...ML_TEAM, canWrite: true },
      });
      vi.mocked(useMissingSecrets).mockReturnValue({
        missing: ["API_KEY"],
        isChecking: false,
      });

      await rerunNow();

      expect(
        screen.getByText(
          "API_KEY isn't one of the ML Research team's secrets, so the run will fail when it starts.",
        ),
      ).toBeInTheDocument();
      expect(mockSubmitPipelineRun).not.toHaveBeenCalled();
    });

    test("waits for the run's team before rerunning", async () => {
      vi.mocked(useRunTeam).mockReturnValue({ status: "resolving" });

      await act(async () => {
        renderWithProviders(
          <RerunPipelineButton componentSpec={componentSpec} />,
        );
      });

      expect(screen.getByTestId("rerun-pipeline-button")).toBeDisabled();
    });

    test("won't rerun a run whose projects are on different teams", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "conflict",
        teams: [ML_TEAM, { id: "data@example.com", label: "Data" }],
      });

      await act(async () => {
        renderWithProviders(
          <RerunPipelineButton componentSpec={componentSpec} />,
        );
      });

      expect(screen.getByTestId("rerun-pipeline-button")).toBeDisabled();
    });
  });
});

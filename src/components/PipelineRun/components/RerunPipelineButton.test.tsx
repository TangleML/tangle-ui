import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  type RunIdentity,
  runIdentity,
} from "@/components/shared/SecretsManagement/runIdentity";
import { useRunIdentity } from "@/components/shared/SecretsManagement/useRunIdentity";
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

vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: () => ({ data: { id: "me@example.com", permissions: [] } }),
}));

vi.mock(
  "@/components/shared/SecretsManagement/useRunIdentity",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useRunIdentity: vi.fn(),
  }),
);

const ML_TEAM = { id: "ml-team@example.com", label: "ML Research" };
const ME = "me@example.com";

const named = (...names: string[]) => names.map((name) => ({ name }));

function ranBy(createdBy: string) {
  mockUseExecutionDataOptional.mockReturnValue({
    metadata: { id: "run-1", created_by: createdBy },
  });
}

function withIdentity(identity: RunIdentity, isChecking = false) {
  vi.mocked(useRunIdentity).mockReturnValue({ ...identity, isChecking });
}

async function blockedReason(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.getByTestId("rerun-pipeline-button");
  expect(button).toBeDisabled();
  const hoverTarget = button.parentElement;
  if (!hoverTarget) {
    throw new Error("A disabled TooltipButton is hovered through its wrapper");
  }
  await user.hover(hoverTarget);
  return screen.findByRole("tooltip");
}

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
    withIdentity(runIdentity({ team: undefined, referenced: [] }));
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

    const ACTIVE = {
      status: "active",
      team: { ...ML_TEAM, canWrite: true },
    } as const;

    test("reruns as you when its secrets don't need the team", async () => {
      vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
      withIdentity(
        runIdentity({
          team: ML_TEAM,
          referenced: ["TEST_PERSONAL"],
          yourSecrets: named("TEST_PERSONAL"),
          teamSecrets: [],
        }),
      );

      await rerunNow();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: undefined }),
        );
      });
    });

    test("reruns as the team when only the team has its secrets", async () => {
      vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
      withIdentity(
        runIdentity({
          team: ML_TEAM,
          referenced: ["Test"],
          yourSecrets: [],
          teamSecrets: named("Test"),
        }),
      );

      await rerunNow();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: ML_TEAM.id }),
        );
      });
    });

    test("lets you choose who reruns it when its secrets are split", async () => {
      vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
      withIdentity(
        runIdentity({
          team: ML_TEAM,
          referenced: ["TEST_PERSONAL", "Test"],
          yourSecrets: named("TEST_PERSONAL"),
          teamSecrets: named("Test"),
        }),
      );

      await rerunNow();

      expect(screen.getByTestId("info-box-title")).toHaveTextContent(
        "Secrets split between you and the workspace",
      );
      expect(mockSubmitPipelineRun).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(
          screen.getByRole("radio", { name: "Workspace: ML Research" }),
        );
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      });

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: ML_TEAM.id }),
        );
      });
    });

    test("reruns the team's run as the team", async () => {
      vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
      ranBy(ML_TEAM.id);

      await rerunNow();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: ML_TEAM.id }),
        );
      });
    });

    test.each([
      ["you're not in its workspace", { status: "not-member", team: ML_TEAM }],
      [
        "you can't act as its workspace",
        { status: "unavailable", team: ML_TEAM },
      ],
    ] as const)("won't rerun the team's run when %s", async (_, resolution) => {
      vi.mocked(useRunTeam).mockReturnValue(resolution);
      ranBy(ML_TEAM.id);
      const user = userEvent.setup();

      await act(async () => {
        renderWithProviders(
          <RerunPipelineButton componentSpec={componentSpec} />,
        );
      });

      expect(await blockedReason(user)).toHaveTextContent(
        "This run went as the ML Research workspace. Only someone who can act as the workspace can rerun it.",
      );
    });

    test("reruns your own run as you when you're not in its team", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "not-member",
        team: ML_TEAM,
      });
      ranBy(ME);

      await rerunNow();

      expect(screen.queryByRole("alertdialog")).toBeNull();
      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: undefined }),
        );
      });
    });

    test("won't rerun someone else's run when its team can't be checked", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "error",
        error: new Error("Lookup failed"),
      });
      ranBy("colleague@example.com");
      const user = userEvent.setup();

      await act(async () => {
        renderWithProviders(
          <RerunPipelineButton componentSpec={componentSpec} />,
        );
      });

      expect(await blockedReason(user)).toHaveTextContent(
        "Couldn't check this run's workspace, so it can't be rerun.",
      );
    });

    test("reruns your own run when its team can't be checked", async () => {
      vi.mocked(useRunTeam).mockReturnValue({
        status: "error",
        error: new Error("Lookup failed"),
      });
      ranBy(ME);

      await rerunNow();

      await waitFor(() => {
        expect(mockSubmitPipelineRun).toHaveBeenCalledWith(
          componentSpec,
          expect.any(String),
          expect.objectContaining({ teamId: undefined }),
        );
      });
    });

    test("asks before rerunning without the secrets the run uses", async () => {
      vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
      withIdentity(
        runIdentity({
          team: ML_TEAM,
          referenced: ["API_KEY"],
          yourSecrets: [],
          teamSecrets: [],
        }),
      );

      await rerunNow();

      expect(screen.getByTestId("info-box-warning")).toHaveTextContent(
        "API_KEY isn't in your secrets, so the run will fail when it starts.",
      );
      expect(mockSubmitPipelineRun).not.toHaveBeenCalled();
    });

    test("waits for the secrets check before rerunning", async () => {
      vi.mocked(useRunTeam).mockReturnValue(ACTIVE);
      withIdentity(runIdentity({ team: ML_TEAM, referenced: [] }), true);

      await act(async () => {
        renderWithProviders(
          <RerunPipelineButton componentSpec={componentSpec} />,
        );
      });

      expect(screen.getByTestId("rerun-pipeline-button")).toBeDisabled();
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

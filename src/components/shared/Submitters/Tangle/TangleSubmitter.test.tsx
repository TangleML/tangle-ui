import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMissingSecrets } from "@/components/shared/SecretsManagement/useMissingSecrets";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForSubmission } from "@/services/teams/useTeamForSubmission";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

import TangleSubmitter from "./TangleSubmitter";

const submit = vi.fn();
const saveAnnotations = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({
    mutationFn,
  }: {
    mutationFn: (variables: unknown) => unknown;
  }) => ({ mutate: mutationFn }),
}));

vi.mock("@/components/shared/Authentication/useAwaitAuthorization", () => ({
  useAwaitAuthorization: () => ({ isAuthorized: true }),
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => false,
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    backendUrl: "https://backend.test",
    configured: true,
    available: true,
  }),
}));

vi.mock("@/providers/TourProvider/tourMockBackend", () => ({
  useTourMockBackend: () => false,
}));

vi.mock("@/components/shared/SecretsManagement/useMissingSecrets", () => ({
  useMissingSecrets: vi.fn(),
}));

vi.mock("@/services/teams/useTeamForSubmission", () => ({
  useTeamForSubmission: vi.fn(),
}));

vi.mock("@/components/Project/RunProjectField", () => ({
  RunProjectField: () => null,
}));

vi.mock("./useRunAttribution", () => ({
  useRunAttribution: () => ({
    projectId: "project-chosen",
    setProjectId: vi.fn(),
    resetToContext: vi.fn(),
    defaultProjectIds: ["project-page"],
    chosenProjectIds: ["project-chosen"],
  }),
}));

vi.mock("./useSubmitPipeline", () => ({
  useSubmitPipeline: () => ({ mutate: submit, isPending: false }),
}));

vi.mock("./saveRunAnnotations", () => ({
  saveRunAnnotations: (...args: unknown[]) => saveAnnotations(...args),
}));

vi.mock("./components/SubmitTaskArgumentsDialog", () => ({
  SubmitTaskArgumentsDialog: ({
    open,
    onConfirm,
    team,
  }: {
    open: boolean;
    onConfirm: (args: Record<string, ArgumentType>, notes: string) => void;
    team: TeamResolution;
  }) =>
    open ? (
      <div role="dialog" data-team-status={team.status}>
        <button type="button" onClick={() => onConfirm({}, "")}>
          Confirm run
        </button>
      </div>
    ) : null,
}));

const spec: ComponentSpec = {
  name: "churn-training",
  implementation: {
    graph: {
      tasks: {
        Greet: {
          componentRef: {
            spec: {
              name: "Greet",
              implementation: {
                container: { image: "python:3.11", command: ["echo"] },
              },
            },
          },
        },
      },
    },
  },
};

const ML_TEAM = { id: "ml-team@example.com", label: "ML Research" };
const DATA_TEAM = { id: "data@example.com", label: "Data" };

function withTeams(page: TeamResolution, chosen: TeamResolution = page) {
  vi.mocked(useTeamForSubmission).mockImplementation((projectIds) =>
    projectIds.includes("project-page") ? page : chosen,
  );
}

const submitButton = () => screen.getByRole("button", { name: /Submit Run/ });

describe("TangleSubmitter", () => {
  beforeEach(() => {
    withTeams({ status: "none" });
    vi.mocked(useMissingSecrets).mockReturnValue({
      missing: [],
      isChecking: false,
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("submits as the page's team and says so", async () => {
    withTeams({ status: "active", team: { ...ML_TEAM, canWrite: true } });
    render(<TangleSubmitter componentSpec={spec} />);
    const user = userEvent.setup();

    expect(screen.getByTestId("submit-as-team")).toHaveTextContent(
      "as ML Research",
    );
    expect(screen.getByTitle(ML_TEAM.id)).toHaveTextContent("ML Research");
    await user.click(submitButton());

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["project-page"],
        teamId: ML_TEAM.id,
      }),
    );
    submit.mock.calls[0][0].onSuccess({ id: 42 });
    expect(saveAnnotations).toHaveBeenCalledWith(
      "42",
      "https://backend.test",
      expect.anything(),
      ML_TEAM.id,
    );
  });

  it("asks you to review a run that would run as you instead of the team", async () => {
    withTeams({ status: "not-member", team: ML_TEAM });
    render(<TangleSubmitter componentSpec={spec} />);
    const user = userEvent.setup();

    await user.click(submitButton());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("asks you to review a run whose secrets are missing", async () => {
    vi.mocked(useMissingSecrets).mockReturnValue({
      missing: ["API_KEY"],
      isChecking: false,
    });
    render(<TangleSubmitter componentSpec={spec} />);
    const user = userEvent.setup();

    await user.click(submitButton());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits straight away outside a team", async () => {
    render(<TangleSubmitter componentSpec={spec} />);
    const user = userEvent.setup();

    await user.click(submitButton());

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: undefined }),
    );
  });

  it("waits for the page's team before submitting", () => {
    withTeams({ status: "resolving" });
    render(<TangleSubmitter componentSpec={spec} />);

    expect(submitButton()).toBeDisabled();
  });

  it("waits for the secrets check before submitting", () => {
    vi.mocked(useMissingSecrets).mockReturnValue({
      missing: [],
      isChecking: true,
    });
    render(<TangleSubmitter componentSpec={spec} />);

    expect(submitButton()).toBeDisabled();
  });

  it("won't submit for projects on different teams", () => {
    withTeams({ status: "conflict", teams: [ML_TEAM, DATA_TEAM] });
    render(<TangleSubmitter componentSpec={spec} />);

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText("(projects on different teams)")).toBeVisible();
  });

  it("submits a reviewed run as the team of the project chosen for it", async () => {
    withTeams(
      { status: "not-member", team: ML_TEAM },
      { status: "active", team: { ...DATA_TEAM, canWrite: true } },
    );
    render(<TangleSubmitter componentSpec={spec} />);
    const user = userEvent.setup();

    await user.click(submitButton());
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-team-status",
      "active",
    );
    await user.click(screen.getByRole("button", { name: "Confirm run" }));

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["project-chosen"],
        teamId: DATA_TEAM.id,
      }),
    );
  });
});

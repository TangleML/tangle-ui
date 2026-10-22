import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RunIdentity,
  runIdentity,
} from "@/components/shared/SecretsManagement/runIdentity";
import { useRunIdentity } from "@/components/shared/SecretsManagement/useRunIdentity";
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

vi.mock("@/components/shared/SecretsManagement/useRunIdentity", () => ({
  useRunIdentity: vi.fn(),
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
    onConfirm: (
      args: Record<string, ArgumentType>,
      notes: string,
      teamId: string | undefined,
    ) => void;
    team: TeamResolution;
  }) =>
    open ? (
      <div role="dialog" data-team-status={team.status}>
        <button type="button" onClick={() => onConfirm({}, "", undefined)}>
          Confirm as you
        </button>
        {team.status === "active" && (
          <button type="button" onClick={() => onConfirm({}, "", team.team.id)}>
            Confirm as the workspace
          </button>
        )}
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
const ML_ACTIVE: TeamResolution = {
  status: "active",
  team: { ...ML_TEAM, canWrite: true },
};

const named = (...names: string[]) => names.map((name) => ({ name }));

function withIdentity(identity: RunIdentity, isChecking = false) {
  vi.mocked(useRunIdentity).mockReturnValue({ ...identity, isChecking });
}

function mlIdentity(referenced: string[], yours: string[], teams: string[]) {
  return runIdentity({
    team: ML_TEAM,
    referenced,
    yourSecrets: named(...yours),
    teamSecrets: named(...teams),
  });
}

function withTeams(page: TeamResolution, chosen: TeamResolution = page) {
  vi.mocked(useTeamForSubmission).mockImplementation((projectIds) =>
    projectIds.includes("project-page") ? page : chosen,
  );
}

const submitButton = () => screen.getByRole("button", { name: /Submit Run/ });

describe("TangleSubmitter", () => {
  beforeEach(() => {
    withTeams({ status: "none" });
    withIdentity(runIdentity({ team: undefined, referenced: [] }));
  });

  afterEach(() => vi.clearAllMocks());

  it.each([
    ["no secrets", mlIdentity([], [], [])],
    [
      "only your own secrets",
      mlIdentity(["TEST_PERSONAL"], ["TEST_PERSONAL"], []),
    ],
  ])(
    "submits as you in a team's project when the run uses %s",
    async (_, identity) => {
      withTeams(ML_ACTIVE);
      withIdentity(identity);
      render(<TangleSubmitter componentSpec={spec} />);
      const user = userEvent.setup();

      expect(screen.queryByTestId("submit-as-team")).toBeNull();
      await user.click(submitButton());

      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: undefined }),
      );
      submit.mock.calls[0][0].onSuccess({ id: 42 });
      expect(saveAnnotations).toHaveBeenCalledWith(
        "42",
        "https://backend.test",
        expect.anything(),
        undefined,
      );
    },
  );

  it("submits as the team, and says so, when only the team has a secret", async () => {
    withTeams(ML_ACTIVE);
    withIdentity(mlIdentity(["Test"], [], ["Test"]));
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

  it("asks you to review a run whose secrets are split between you and the team", async () => {
    withTeams(ML_ACTIVE);
    withIdentity(
      mlIdentity(["TEST_PERSONAL", "Test"], ["TEST_PERSONAL"], ["Test"]),
    );
    render(<TangleSubmitter componentSpec={spec} />);
    const user = userEvent.setup();

    await user.click(submitButton());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
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
    withIdentity(
      runIdentity({
        team: undefined,
        referenced: ["API_KEY"],
        yourSecrets: [],
      }),
    );
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
    withIdentity(runIdentity({ team: undefined, referenced: [] }), true);
    render(<TangleSubmitter componentSpec={spec} />);

    expect(submitButton()).toBeDisabled();
  });

  it("won't submit for projects on different teams", () => {
    withTeams({ status: "conflict", teams: [ML_TEAM, DATA_TEAM] });
    render(<TangleSubmitter componentSpec={spec} />);

    expect(submitButton()).toBeDisabled();
    expect(
      screen.getByText("(projects on different workspaces)"),
    ).toBeVisible();
  });

  it("submits a reviewed run as the identity chosen in it", async () => {
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
    await user.click(
      screen.getByRole("button", { name: "Confirm as the workspace" }),
    );

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        projectIds: ["project-chosen"],
        teamId: DATA_TEAM.id,
      }),
    );
    submit.mock.calls[0][0].onSuccess({ id: 42 });
    expect(saveAnnotations).toHaveBeenCalledWith(
      "42",
      "https://backend.test",
      expect.anything(),
      DATA_TEAM.id,
    );
  });

  it("submits a reviewed run as you when you choose yourself on a team's page", async () => {
    withTeams(ML_ACTIVE);
    withIdentity(mlIdentity(["Test"], [], ["Test"]));
    render(
      <TangleSubmitter
        componentSpec={{ ...spec, inputs: [{ name: "epochs" }] }}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByTestId("submit-as-team")).toHaveTextContent(
      "as ML Research",
    );
    await user.click(screen.getByTestId("run-with-arguments-button"));
    await user.click(screen.getByRole("button", { name: "Confirm as you" }));

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: undefined }),
    );
    submit.mock.calls[0][0].onSuccess({ id: 42 });
    expect(saveAnnotations).toHaveBeenCalledWith(
      "42",
      "https://backend.test",
      expect.anything(),
      undefined,
    );
  });

  it("checks the run's secrets against the page's team", () => {
    const pageTeam: TeamResolution = { status: "not-member", team: ML_TEAM };
    withTeams(pageTeam, {
      status: "active",
      team: { ...DATA_TEAM, canWrite: true },
    });

    render(<TangleSubmitter componentSpec={spec} />);

    expect(useRunIdentity).toHaveBeenCalledWith(pageTeam, [spec]);
  });
});

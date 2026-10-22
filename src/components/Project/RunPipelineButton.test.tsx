import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSubmitPipeline } from "@/components/shared/Submitters/Tangle/useSubmitPipeline";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForSubmission } from "@/services/teams/useTeamForSubmission";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

import { RunPipelineButton } from "./RunPipelineButton";

const submit = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const saveAnnotations = vi.fn();

vi.mock("@/components/shared/Submitters/Tangle/useSubmitPipeline", () => ({
  useSubmitPipeline: vi.fn(),
}));

vi.mock("@/components/shared/Submitters/Tangle/saveRunAnnotations", () => ({
  saveRunAnnotations: (...args: unknown[]) => saveAnnotations(...args),
}));

vi.mock("@/services/teams/useTeamForSubmission", () => ({
  useTeamForSubmission: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.test", available: true }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({
    mutationFn,
  }: {
    mutationFn: (variables: unknown) => unknown;
  }) => ({ mutate: mutationFn }),
}));

vi.mock(
  "@/components/shared/Submitters/Tangle/components/SubmitTaskArgumentsDialog",
  () => ({
    SubmitTaskArgumentsDialog: ({
      onConfirm,
      showCopyFromRun,
      team,
    }: {
      onConfirm: (
        args: Record<string, ArgumentType>,
        notes: string,
        teamId: string | undefined,
      ) => void;
      showCopyFromRun?: boolean;
      team: TeamResolution;
    }) => (
      <div
        role="dialog"
        data-copy-from-run={String(showCopyFromRun)}
        data-team-status={team.status}
      >
        <button
          type="button"
          onClick={() =>
            onConfirm({ name: "Morgan" }, "why this run", undefined)
          }
        >
          Submit Run
        </button>
        {team.status === "active" && (
          <button
            type="button"
            onClick={() =>
              onConfirm({ name: "Morgan" }, "why this run", team.team.id)
            }
          >
            Submit as the workspace
          </button>
        )}
      </div>
    ),
  }),
);

const runnableSpec: ComponentSpec = {
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

const emptySpec: ComponentSpec = {
  name: "nothing-here",
  implementation: { graph: { tasks: {} } },
};

function renderButton(props: Partial<Parameters<typeof RunPipelineButton>[0]>) {
  return render(
    <RunPipelineButton projectId="project-1" spec={runnableSpec} {...props} />,
  );
}

const runButton = () => screen.getByRole("button", { name: /Run pipeline/ });

describe("RunPipelineButton", () => {
  beforeEach(() => {
    vi.mocked(useTeamForSubmission).mockReturnValue({ status: "none" });
    vi.mocked(useSubmitPipeline).mockReturnValue({
      mutate: submit,
      isPending: false,
    } as unknown as ReturnType<typeof useSubmitPipeline>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("asks for the run's arguments before starting it", async () => {
    renderButton({});
    const user = userEvent.setup();

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(runButton());

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  /** The whole point: a run started here belongs to the project it was started from. */
  it("starts the run in the project it was pressed in", async () => {
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Submit Run" }));

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        componentSpec: runnableSpec,
        taskArguments: { name: "Morgan" },
        projectIds: ["project-1"],
      }),
    );
  });

  it("offers the secrets of the project's team", async () => {
    vi.mocked(useTeamForSubmission).mockReturnValue({
      status: "active",
      team: { id: "ml-team@example.com", label: "ML Research", canWrite: true },
    });
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());

    expect(useTeamForSubmission).toHaveBeenCalledWith(["project-1"]);
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-team-status",
      "active",
    );
  });

  it("keeps the notes the run was submitted with", async () => {
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Submit Run" }));
    const { onSuccess } = submit.mock.calls[0][0];
    onSuccess({ id: 42 });

    expect(saveAnnotations).toHaveBeenCalledWith(
      "42",
      "https://backend.test",
      expect.objectContaining({ notes: "why this run" }),
      undefined,
    );
  });

  it("starts the run as the identity chosen in the dialog", async () => {
    vi.mocked(useTeamForSubmission).mockReturnValue({
      status: "active",
      team: { id: "ml-team@example.com", label: "ML Research", canWrite: true },
    });
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());
    await user.click(
      screen.getByRole("button", { name: "Submit as the workspace" }),
    );
    submit.mock.calls[0][0].onSuccess({ id: 42 });

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: "ml-team@example.com" }),
    );
    expect(saveAnnotations).toHaveBeenCalledWith(
      "42",
      "https://backend.test",
      expect.objectContaining({ notes: "why this run" }),
      "ml-team@example.com",
    );
  });

  it("says the run has started, in the project's own terms", async () => {
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Submit Run" }));
    submit.mock.calls[0][0].onSuccess({ id: 42 });

    expect(notify).toHaveBeenCalledWith(
      "Run started in this project",
      "success",
    );
  });

  it("says so when the run could not be started", async () => {
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());
    await user.click(screen.getByRole("button", { name: "Submit Run" }));
    submit.mock.calls[0][0].onError(new Error("Backend said no"));

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Backend said no"),
      "error",
    );
  });

  it("does not offer to run a pipeline that does not validate", () => {
    renderButton({ spec: emptySpec });

    expect(runButton()).toBeDisabled();
  });

  it("does not offer to run while a run is already being started", () => {
    vi.mocked(useSubmitPipeline).mockReturnValue({
      mutate: submit,
      isPending: true,
    } as unknown as ReturnType<typeof useSubmitPipeline>);
    renderButton({});

    expect(runButton()).toBeDisabled();
  });

  /**
   * Past runs are looked up by the pipeline's name in this browser, so for a
   * pipeline the backend holds they would be some other pipeline's runs.
   */
  it("offers past runs to copy from only for the pipeline this browser holds", async () => {
    const user = userEvent.setup();

    renderButton({ heldInThisBrowser: true });
    await user.click(runButton());

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-copy-from-run",
      "true",
    );
  });

  it("does not offer past runs for a pipeline the backend holds", async () => {
    renderButton({});
    const user = userEvent.setup();

    await user.click(runButton());

    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-copy-from-run",
      "false",
    );
  });
});

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSecretArgument } from "@/components/shared/SecretsManagement/types";
import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpec } from "@/models/componentSpec/serialization/serialize";
import { ProjectRunsQueryKeys } from "@/services/projects/types";
import type { TeamResolution } from "@/services/teams/types";
import { submitPipelineRun } from "@/utils/submitPipeline";

import { createRunBridgeHandlers } from "./runBridge";
import type { BridgeDeps } from "./utils";

vi.mock("@/utils/submitPipeline", () => ({ submitPipelineRun: vi.fn() }));

vi.mock("@/models/componentSpec/serialization/serialize", () => ({
  serializeComponentSpec: vi.fn(() => ({ name: "Churn" })),
}));

const { fetchSecrets } = vi.hoisted(() => ({ fetchSecrets: vi.fn() }));

vi.mock("@/components/shared/SecretsManagement/secretsStorage", async () => {
  const { SecretsQueryKeys } =
    await import("@/components/shared/SecretsManagement/types");
  return {
    secretsListQuery: (teamId?: string) => ({
      queryKey: SecretsQueryKeys.All(teamId),
      queryFn: () => fetchSecrets(teamId),
    }),
  };
});

const PROJECT_ANNOTATION = "tangleml.com/project/id/project-9";

function deps(overrides: Partial<BridgeDeps> = {}): BridgeDeps {
  return {
    getSpec: () => ({ name: "Churn" }) as unknown as ComponentSpec,
    getActiveSubgraphPath: () => [],
    getActiveSubgraphTaskId: () => undefined,
    getBackendUrl: () => "http://backend",
    getRunAnnotations: () => ({ [PROJECT_ANNOTATION]: "true" }),
    ...overrides,
  };
}

function succeedsWithRun() {
  vi.mocked(submitPipelineRun).mockImplementation(
    async (_spec, _url, options) => {
      options?.onSuccess?.({ id: 7, root_execution_id: 42 } as never);
    },
  );
}

describe("runBridge submitPipelineRun", () => {
  beforeEach(() => succeedsWithRun());
  afterEach(() => vi.resetAllMocks());

  /**
   * A run says which project it belongs to through an annotation written when
   * it is created, so an agent submitting without one leaves a run that cannot
   * be attributed to the project it was asked for afterwards.
   */
  it("attributes the run to the project the editor is scoped to", async () => {
    await createRunBridgeHandlers(deps()).submitPipelineRun();

    expect(vi.mocked(submitPipelineRun).mock.calls[0][2]).toMatchObject({
      runAnnotations: { [PROJECT_ANNOTATION]: "true" },
    });
    expect(serializeComponentSpec).toHaveBeenCalled();
  });

  /** Everything reaching this bridge is an agent, not somebody clicking Run. */
  it("records the run as the agent's rather than the web app's", async () => {
    await createRunBridgeHandlers(deps()).submitPipelineRun();

    expect(vi.mocked(submitPipelineRun).mock.calls[0][2]).toMatchObject({
      runSource: "tangent-ui",
    });
  });

  it("refreshes the run feed of every project the run belongs to", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await createRunBridgeHandlers(deps({ queryClient })).submitPipelineRun();

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ProjectRunsQueryKeys.All("project-9"),
    });
  });

  it("refreshes nothing project-shaped when the run belongs to none", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await createRunBridgeHandlers(
      deps({ queryClient, getRunAnnotations: () => ({}) }),
    ).submitPipelineRun();

    for (const [{ queryKey }] of invalidate.mock.calls as [
      { queryKey: readonly unknown[] },
    ][]) {
      expect(queryKey[0]).not.toBe("projects");
    }
  });

  it("reports why the backend refused rather than a bare failure", async () => {
    vi.mocked(submitPipelineRun).mockImplementation(
      async (_spec, _url, options) => {
        options?.onError?.(new Error("spec is invalid"));
      },
    );

    const result = await createRunBridgeHandlers(deps()).submitPipelineRun();

    expect(result).toEqual({ success: false, error: "spec is invalid" });
  });

  describe("in a team's project", () => {
    const TEAM = { id: "ml-team@example.com", label: "ML Research" };
    const inTeam = () =>
      deps({
        queryClient: new QueryClient(),
        getRunTeam: () => ({
          status: "active",
          team: { ...TEAM, canWrite: true },
        }),
      });

    const usingSecrets = (...names: string[]) => {
      vi.mocked(serializeComponentSpec).mockReturnValue({
        name: "Churn",
        arguments: Object.fromEntries(
          names.map((name) => [name, createSecretArgument(name)]),
        ),
      } as never);
    };

    const withSecrets = (yours: string[], teams: string[]) => {
      fetchSecrets.mockImplementation(async (teamId?: string) =>
        (teamId ? teams : yours).map((name) => ({ name })),
      );
    };

    const submittedTeamId = () =>
      vi.mocked(submitPipelineRun).mock.calls[0][2]?.teamId;

    it("submits as the user by default", async () => {
      const result =
        await createRunBridgeHandlers(inTeam()).submitPipelineRun();

      expect(submittedTeamId()).toBeUndefined();
      expect(result).toMatchObject({
        success: true,
        actingAsTeam: undefined,
        actingAsWorkspace: undefined,
      });
      expect(result.warning).toBeUndefined();
    });

    it("submits as the team when asked to", async () => {
      const result = await createRunBridgeHandlers(inTeam()).submitPipelineRun({
        asTeam: true,
      });

      expect(submittedTeamId()).toBe(TEAM.id);
      expect(result).toMatchObject({
        success: true,
        actingAsTeam: TEAM.id,
        actingAsWorkspace: "ML Research",
      });
    });

    it("submits as the team, and says why, when only the team has a secret it uses", async () => {
      usingSecrets("Test");
      withSecrets([], ["Test"]);

      const result =
        await createRunBridgeHandlers(inTeam()).submitPipelineRun();

      expect(submittedTeamId()).toBe(TEAM.id);
      expect(result.actingAsTeam).toBe(TEAM.id);
      expect(result.warning).toBe(
        "Submitted as the ML Research workspace, because only the workspace has Test.",
      );
      expect(fetchSecrets).toHaveBeenCalledWith(undefined);
      expect(fetchSecrets).toHaveBeenCalledWith(TEAM.id);
    });

    it("submits as the team when only it has some of the secrets, though others are in neither", async () => {
      usingSecrets("Test", "GONE");
      withSecrets([], ["Test"]);

      const result =
        await createRunBridgeHandlers(inTeam()).submitPipelineRun();

      expect(submittedTeamId()).toBe(TEAM.id);
      expect(result.warning).toBe(
        "Submitted as the ML Research workspace, because only the workspace has Test. GONE isn't in the ML Research workspace's secrets, so the run will fail at launch.",
      );
    });

    it("submits as the user when they have every secret", async () => {
      usingSecrets("TEST_PERSONAL");
      withSecrets(["TEST_PERSONAL"], []);

      const result =
        await createRunBridgeHandlers(inTeam()).submitPipelineRun();

      expect(submittedTeamId()).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it("refuses a run whose secrets are split between the user and the team", async () => {
      usingSecrets("TEST_PERSONAL", "Test");
      withSecrets(["TEST_PERSONAL"], ["Test"]);

      const result =
        await createRunBridgeHandlers(inTeam()).submitPipelineRun();

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(
        /^TEST_PERSONAL is only in the user's secrets and Test is only in the ML Research workspace's, so the run would fail whichever it went as\. Nothing was submitted\./,
      );
    });

    it("warns about a secret the identity it went as doesn't have", async () => {
      usingSecrets("GONE");
      withSecrets([], []);

      const result = await createRunBridgeHandlers(inTeam()).submitPipelineRun({
        asTeam: true,
      });

      expect(result.success).toBe(true);
      expect(result.warning).toBe(
        "GONE isn't in the ML Research workspace's secrets, so the run will fail at launch.",
      );
    });

    it("submits as the user when they're not in the team", async () => {
      const result = await createRunBridgeHandlers(
        deps({ getRunTeam: () => ({ status: "not-member", team: TEAM }) }),
      ).submitPipelineRun();

      expect(submittedTeamId()).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.actingAsTeam).toBeUndefined();
    });

    it("won't act as a team the user isn't in", async () => {
      const result = await createRunBridgeHandlers(
        deps({ getRunTeam: () => ({ status: "not-member", team: TEAM }) }),
      ).submitPipelineRun({ asTeam: true });

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error:
          "The user isn't in the ML Research workspace, so the run can't act as it. Nothing was submitted. Don't retry it as the user unless they ask for that.",
      });
    });

    it.each<[string, TeamResolution, RegExp]>([
      [
        "the backend refuses it",
        { status: "unavailable", team: TEAM },
        /^The backend didn't let the user act as the ML Research workspace\./,
      ],
      [
        "it couldn't be checked",
        { status: "error", error: new Error("backend down") },
        /^This project's workspace couldn't be checked: backend down\./,
      ],
    ])("won't act as a team when %s", async (_, runTeam, refusal) => {
      const result = await createRunBridgeHandlers(
        deps({ getRunTeam: () => runTeam }),
      ).submitPipelineRun({ asTeam: true });

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(refusal);
    });

    it("won't act as a team outside a team's project", async () => {
      const result = await createRunBridgeHandlers(deps()).submitPipelineRun({
        asTeam: true,
      });

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result.error).toMatch(
        /^Runs in this project can't act as a workspace\./,
      );
    });

    it("waits for the team before submitting", async () => {
      const result = await createRunBridgeHandlers(
        deps({ getRunTeam: () => ({ status: "resolving" }) }),
      ).submitPipelineRun();

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error:
          "This project's workspace is still being checked. Try again in a moment.",
      });
    });

    it("refuses a run whose projects are on different teams", async () => {
      const result = await createRunBridgeHandlers(
        deps({
          getRunTeam: () => ({
            status: "conflict",
            teams: [TEAM, { id: "data@example.com", label: "Data" }],
          }),
        }),
      ).submitPipelineRun();

      expect(submitPipelineRun).not.toHaveBeenCalled();
      expect(result.error).toMatch(
        /different workspaces \(ML Research and Data\)/,
      );
    });
  });
});

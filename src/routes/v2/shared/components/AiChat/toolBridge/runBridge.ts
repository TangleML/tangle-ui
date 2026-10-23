/**
 * Run-lifecycle bridge handlers.
 *
 * `submitPipelineRun` wraps the existing `@/utils/submitPipeline` helper
 * (so cache invalidation + IDB persistence + auth-token plumbing match
 * the editor's submitter UI exactly), differing only in the run source it
 * records: everything reaching this bridge was submitted by an agent, in the
 * editor's assistant or through the Tangent tab bridge, and a run nobody
 * clicked Run on should not report that somebody did. `getRunDetails` is a
 * thin pass-through to the execution service.
 *
 * `debugPipelineRun` is the composite read path used by
 * `debug-assistant`: it fetches the run, the root execution details +
 * state in parallel, then walks failed children (capped at 10) and
 * truncates everything through `@/agent/util/truncate` so a single call
 * cannot blow context.
 */
import type {
  ContainerState,
  RunDebugSnapshot,
  RunDebugSnapshotChild,
  RunDetails,
  RunSubmissionOptions,
  RunSubmissionResult,
  ToolBridgeApi,
} from "@/agent/toolBridgeApi";
import {
  truncateContainerLog,
  truncateContainerState,
  truncateExecutionDetails,
} from "@/agent/util/truncate";
import {
  type RunAs,
  runAsFor,
  type RunAsRule,
  type RunIdentity,
  runIdentity,
  teamIdFor,
} from "@/components/shared/SecretsManagement/runIdentity";
import { referencedSecretNames } from "@/components/shared/SecretsManagement/secretReferences";
import { secretsListQuery } from "@/components/shared/SecretsManagement/secretsStorage";
import { serializeComponentSpec } from "@/models/componentSpec/serialization/serialize";
import { ONBOARDING_MY_RUN_COUNT_KEY } from "@/providers/OnboardingProvider/onboardingQueryKeys";
import {
  fetchContainerExecutionState,
  fetchContainerLog,
  fetchExecutionDetails,
  fetchExecutionState,
  fetchPipelineRun,
} from "@/services/executionService";
import { invalidateProjectRunQueries } from "@/services/projects/useProjectRuns";
import type { TeamResolution, TeamSummary } from "@/services/teams/types";
import type { PipelineRun } from "@/types/pipelineRun";
import { TANGENT_UI_RUN_SOURCE } from "@/utils/annotationKeys";
import {
  flattenExecutionStatusStats,
  getOverallExecutionStatusFromStats,
} from "@/utils/executionStatus";
import { submitPipelineRun as submitPipelineRunHelper } from "@/utils/submitPipeline";

import type { BridgeDeps } from "./utils";
import { errorMessage, requireBackendUrl, requireSpec } from "./utils";

const MAX_FAILED_CHILDREN = 10;
const FAILED_STATUSES = new Set(["FAILED", "SYSTEM_ERROR", "INVALID"]);

type RunHandlers = Pick<
  ToolBridgeApi,
  "submitPipelineRun" | "getRunDetails" | "debugPipelineRun"
>;

function refusalFor(team: TeamResolution): string | undefined {
  if (team.status === "resolving") {
    return "This project's workspace is still being checked. Try again in a moment.";
  }
  if (team.status === "conflict") {
    const names = team.teams.map((candidate) => candidate.label).join(" and ");
    return `This run's projects belong to different workspaces (${names}), so it can't act as one. File it under projects on one workspace.`;
  }
  return undefined;
}

const NOT_SUBMITTED_AS_TEAM =
  "Nothing was submitted. Don't retry it as the user unless they ask for that.";

function asTeamRefusal(team: TeamResolution): string | undefined {
  switch (team.status) {
    case "none":
      return `Runs in this project can't act as a workspace. ${NOT_SUBMITTED_AS_TEAM}`;
    case "not-member":
      return `The user isn't in the ${team.team.label} workspace, so the run can't act as it. ${NOT_SUBMITTED_AS_TEAM}`;
    case "unavailable":
      return `The backend didn't let the user act as the ${team.team.label} workspace. ${NOT_SUBMITTED_AS_TEAM}`;
    case "error":
      return `This project's workspace couldn't be checked: ${team.error.message}. ${NOT_SUBMITTED_AS_TEAM}`;
    default:
      return undefined;
  }
}

const isOrAre = (names: readonly string[]) =>
  `${names.join(", ")} ${names.length === 1 ? "is" : "are"}`;

function splitRefusal(
  rule: Extract<RunAsRule, { kind: "split" }>,
  team: TeamSummary,
): string {
  return `${isOrAre(rule.yoursOnly)} only in the user's secrets and ${isOrAre(rule.teamOnly)} only in the ${team.label} workspace's, so the run would fail whichever it went as. Nothing was submitted. Ask the user which to use, or to add the missing secrets to one of them.`;
}

function submissionNote(identity: RunIdentity, runAs: RunAs, asTeam: boolean) {
  const notes: string[] = [];
  const { team, missing: missingFrom } = identity;
  if (!asTeam && runAs === "team" && team) {
    const teamOnly = missingFrom.you.filter(
      (name) => !missingFrom.team.includes(name),
    );
    notes.push(
      `Submitted as the ${team.label} workspace, because only the workspace has ${teamOnly.join(", ")}.`,
    );
  }
  const missing = identity.missing[runAs];
  if (missing.length > 0) {
    const whose =
      runAs === "team" && team
        ? `the ${team.label} workspace's secrets`
        : "the user's secrets";
    notes.push(
      `${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} in ${whose}, so the run will fail at launch.`,
    );
  }
  return notes.length > 0 ? notes.join(" ") : undefined;
}

async function checkRunIdentity(
  deps: BridgeDeps,
  team: TeamSummary | undefined,
  referenced: string[],
): Promise<RunIdentity> {
  if (referenced.length === 0) return runIdentity({ team, referenced });

  const listSecrets = (teamId?: string) => {
    const query = secretsListQuery(teamId);
    const listing = deps.queryClient
      ? deps.queryClient.fetchQuery(query)
      : query.queryFn();
    return listing.catch(() => undefined);
  };
  const [yourSecrets, teamSecrets] = await Promise.all([
    listSecrets(),
    team ? listSecrets(team.id) : undefined,
  ]);
  return runIdentity({ team, referenced, yourSecrets, teamSecrets });
}

export function createRunBridgeHandlers(deps: BridgeDeps): RunHandlers {
  return {
    async submitPipelineRun({
      asTeam = false,
    }: RunSubmissionOptions = {}): Promise<RunSubmissionResult> {
      const spec = requireSpec(deps);
      const backendUrl = deps.getBackendUrl?.();
      if (!backendUrl) {
        return {
          success: false,
          error:
            "Backend is not configured — pipeline cannot be submitted from the assistant.",
        };
      }
      const runTeam = deps.getRunTeam?.() ?? { status: "none" };
      const refusal =
        refusalFor(runTeam) ?? (asTeam ? asTeamRefusal(runTeam) : undefined);
      if (refusal) return { success: false, error: refusal };
      const team = runTeam.status === "active" ? runTeam.team : undefined;
      const wireSpec = serializeComponentSpec(spec);
      const identity = await checkRunIdentity(
        deps,
        team,
        referencedSecretNames(wireSpec),
      );
      if (!asTeam && identity.rule.kind === "split" && team) {
        return { success: false, error: splitRefusal(identity.rule, team) };
      }
      const runAs = runAsFor(identity, asTeam ? "team" : undefined);
      const teamId = teamIdFor(identity, runAs);
      const authorizationToken = deps.getAuthToken?.();
      const runAnnotations = deps.getRunAnnotations?.();
      const submission = await new Promise<{
        run: PipelineRun | null;
        error: string | null;
      }>((resolve) => {
        submitPipelineRunHelper(wireSpec, backendUrl, {
          authorizationToken,
          teamId,
          runAnnotations,
          runSource: TANGENT_UI_RUN_SOURCE,
          onSuccess: (data) => resolve({ run: data, error: null }),
          onError: (err) => resolve({ run: null, error: errorMessage(err) }),
        });
      });
      if (!submission.run) {
        return {
          success: false,
          error:
            submission.error ??
            "Pipeline submission failed — the backend rejected the run.",
        };
      }
      // Refresh both the editor list (per pipeline) and the home runs page.
      deps.queryClient?.invalidateQueries({ queryKey: ["pipelineRuns"] });
      // Keep the onboarding checklist's run-count fresh so a first run flips
      // `execute_run` immediately rather than after its stale window.
      deps.queryClient?.invalidateQueries({
        queryKey: ONBOARDING_MY_RUN_COUNT_KEY,
      });
      if (deps.queryClient) {
        void invalidateProjectRunQueries(deps.queryClient, runAnnotations);
      }
      return {
        success: true,
        runId: String(submission.run.id),
        rootExecutionId: String(submission.run.root_execution_id),
        actingAsTeam: teamId,
        actingAsWorkspace: teamId ? team?.label : undefined,
        warning: submissionNote(identity, runAs, asTeam),
      };
    },

    async getRunDetails(runId) {
      return fetchPipelineRun(runId, requireBackendUrl(deps));
    },

    async debugPipelineRun(runId): Promise<RunDebugSnapshot> {
      const backendUrl = deps.getBackendUrl?.();
      if (!backendUrl) {
        return {
          success: false,
          failedChildren: [],
          truncatedChildren: 0,
          error:
            "Backend is not configured — cannot fetch debug info for this run.",
        };
      }
      let run: RunDetails;
      try {
        run = await fetchPipelineRun(runId, backendUrl);
      } catch (error) {
        return {
          success: false,
          failedChildren: [],
          truncatedChildren: 0,
          error: errorMessage(error),
        };
      }
      const rootId = run.root_execution_id;
      const [rootDetails, rootStateOrNull] = await Promise.all([
        fetchExecutionDetails(rootId, backendUrl).catch(() => null),
        fetchExecutionState(rootId, backendUrl).catch(() => null),
      ]);
      if (!rootDetails && !rootStateOrNull) {
        return {
          success: false,
          failedChildren: [],
          truncatedChildren: 0,
          error:
            "Could not fetch execution details for the run (execution details and state both failed).",
        };
      }
      const rootStatus = rootStateOrNull
        ? getOverallExecutionStatusFromStats(
            flattenExecutionStatusStats(
              rootStateOrNull.child_execution_status_stats,
            ),
          )
        : undefined;
      const candidates = Object.entries(
        rootDetails?.child_task_execution_ids ?? {},
      );
      const inspected = await Promise.all(
        candidates.map(([taskId, executionId]) =>
          inspectFailedChild(taskId, executionId, backendUrl),
        ),
      );
      const allFailed = inspected.filter(
        (c): c is RunDebugSnapshotChild => c !== null,
      );
      const failedChildren = allFailed.slice(0, MAX_FAILED_CHILDREN);
      const truncatedChildren = Math.max(
        0,
        allFailed.length - MAX_FAILED_CHILDREN,
      );
      return {
        success: true,
        run,
        rootExecutionId: rootId,
        rootStatus,
        failedChildren,
        truncatedChildren,
      };
    },
  };
}

async function inspectFailedChild(
  taskId: string,
  executionId: string,
  backendUrl: string,
): Promise<RunDebugSnapshotChild | null> {
  let containerState: ContainerState | null = null;
  try {
    containerState = await fetchContainerExecutionState(
      executionId,
      backendUrl,
    );
  } catch {
    return null;
  }
  if (!FAILED_STATUSES.has(containerState.status)) return null;
  const [details, log] = await Promise.all([
    fetchExecutionDetails(executionId, backendUrl).catch(() => null),
    fetchContainerLog(executionId, backendUrl).catch(() => null),
  ]);
  return {
    taskId,
    executionId,
    status: containerState.status,
    details: details ? truncateExecutionDetails(details) : undefined,
    containerState: truncateContainerState(containerState),
    log: log ? truncateContainerLog(log) : undefined,
  };
}

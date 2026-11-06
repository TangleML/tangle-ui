import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import {
  needsReview,
  type RunAs,
  runAsFor,
  type RunIdentity,
  teamIdFor,
} from "@/components/shared/SecretsManagement/runIdentity";
import {
  useRunAsChoice,
  useRunIdentity,
} from "@/components/shared/SecretsManagement/useRunIdentity";
import { useRerunProjectIds } from "@/hooks/useRerunProjectIds";
import useToastNotification from "@/hooks/useToastNotification";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useBackend } from "@/providers/BackendProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { useRunSubmissionAnnotations } from "@/providers/RunSubmissionScopeProvider";
import { getDefaultRunPath } from "@/routes/runRoutes";
import type { TeamResolution, TeamSummary } from "@/services/teams/types";
import { useRunTeam } from "@/services/teams/useRunTeam";
import type { PipelineRun } from "@/types/pipelineRun";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";
import { projectRunAnnotations } from "@/utils/projectRunAnnotation";
import { submitPipelineRun } from "@/utils/submitPipeline";

interface RerunVariables {
  componentSpec: ComponentSpec;
  canonicalName?: string;
  taskArguments?: Record<string, ArgumentType>;
  teamId?: string;
}

export interface RerunReview {
  isOpen: boolean;
  team: TeamResolution;
  identity: RunIdentity;
  runAs: RunAs;
  chooseRunAs: (runAs: RunAs) => void;
  confirm: () => void;
  dismiss: () => void;
}

export type RerunBlock =
  { kind: "team-only"; team: TeamSummary } | { kind: "team-unchecked" };

function teamThatRan(
  createdBy: string | null | undefined,
  runTeam: TeamResolution,
): TeamSummary | undefined {
  if (
    runTeam.status !== "active" &&
    runTeam.status !== "not-member" &&
    runTeam.status !== "unavailable"
  ) {
    return undefined;
  }
  return createdBy === runTeam.team.id ? runTeam.team : undefined;
}

function rerunBlock(
  ranAs: TeamSummary | undefined,
  runTeam: TeamResolution,
  isYours: boolean,
): RerunBlock | undefined {
  if (ranAs && runTeam.status !== "active") {
    return { kind: "team-only", team: ranAs };
  }
  if (runTeam.status === "error" && !isYours) {
    return { kind: "team-unchecked" };
  }
  return undefined;
}

export function useRerunPipelineRun(componentSpec?: ComponentSpec) {
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { backendUrl } = useBackend();
  const { awaitAuthorization, isAuthorized } = useAwaitAuthorization();
  const { getToken } = useAuthLocalStorage();
  const executionData = useExecutionDataOptional();
  const runAnnotations = useRunSubmissionAnnotations();
  const rerunProjectIds = useRerunProjectIds();
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const runId = executionData?.metadata?.id;
  const taskSpec = executionData?.rootDetails?.task_spec;
  const taskArguments = taskSpec?.arguments as
    Record<string, ArgumentType> | undefined;

  const createdBy = executionData?.metadata?.created_by;
  const { data: currentUser } = useUserDetails();

  const runTeam = useRunTeam(runId);
  const identity = useRunIdentity(runTeam, [componentSpec, taskArguments]);
  const { runAs: reviewedRunAs, choose: chooseRunAs } =
    useRunAsChoice(identity);

  const ranAsTeam = teamThatRan(createdBy, runTeam);
  const blocked = rerunBlock(
    ranAsTeam,
    runTeam,
    !!currentUser?.id && createdBy === currentUser.id,
  );

  const getAuthToken = async (): Promise<string | undefined> => {
    if (isAuthorizationRequired() && !isAuthorized) {
      const token = await awaitAuthorization();
      if (token) {
        return token;
      }
    }
    return getToken();
  };

  const { mutate: rerunPipeline, isPending: isRerunning } = useMutation({
    mutationFn: async ({
      componentSpec,
      canonicalName,
      taskArguments,
      teamId,
    }: RerunVariables) => {
      const authorizationToken = await getAuthToken();
      const projectIds = await rerunProjectIds(runId);
      return new Promise<PipelineRun>((resolve, reject) => {
        submitPipelineRun(componentSpec, backendUrl, {
          canonicalName,
          taskArguments,
          authorizationToken,
          teamId,
          runAnnotations: {
            ...runAnnotations,
            ...projectRunAnnotations(projectIds),
          },
          onSuccess: resolve,
          onError: reject,
        });
      });
    },
    onSuccess: (response) => {
      navigate({ to: getDefaultRunPath(response.id) });
    },
    onError: (error) => {
      const message = `Failed to submit pipeline. ${error instanceof Error ? error.message : String(error)}`;
      notify(message, "error");
    },
  });

  const submitRerun = (teamId: string | undefined) => {
    if (!componentSpec) return;

    rerunPipeline({
      componentSpec,
      canonicalName: extractCanonicalName(
        buildTaskSpecShape(taskSpec, componentSpec),
      ),
      taskArguments,
      teamId,
    });
  };

  const rerun = () => {
    if (ranAsTeam) {
      submitRerun(ranAsTeam.id);
      return;
    }
    if (needsReview(identity)) {
      chooseRunAs(undefined);
      setIsReviewOpen(true);
      return;
    }
    submitRerun(teamIdFor(identity, runAsFor(identity)));
  };

  const canRerun =
    !blocked &&
    runTeam.status !== "resolving" &&
    runTeam.status !== "conflict" &&
    !identity.isChecking;

  const review: RerunReview = {
    isOpen: isReviewOpen,
    team: runTeam,
    identity,
    runAs: reviewedRunAs,
    chooseRunAs,
    confirm: () => {
      setIsReviewOpen(false);
      submitRerun(teamIdFor(identity, reviewedRunAs));
    },
    dismiss: () => setIsReviewOpen(false),
  };

  return { rerun, isRerunning, canRerun, blocked, review };
}

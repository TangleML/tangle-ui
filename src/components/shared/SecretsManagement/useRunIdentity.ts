import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { TeamResolution } from "@/services/teams/types";

import {
  type RunAs,
  runAsFor,
  type RunIdentity,
  runIdentity,
} from "./runIdentity";
import { referencedSecretNames } from "./secretReferences";
import { secretsListQuery } from "./secretsStorage";

interface CheckedRunIdentity extends RunIdentity {
  isChecking: boolean;
}

export function useRunIdentity(
  resolution: TeamResolution,
  sources: readonly unknown[],
): CheckedRunIdentity {
  const referenced = referencedSecretNames(...sources);
  const team = resolution.status === "active" ? resolution.team : undefined;
  const settled =
    resolution.status !== "resolving" && resolution.status !== "conflict";
  const shouldCheck = settled && referenced.length > 0;

  const yourSecrets = useQuery({ ...secretsListQuery(), enabled: shouldCheck });
  const teamSecrets = useQuery({
    ...secretsListQuery(team?.id),
    enabled: shouldCheck && team !== undefined,
  });

  const unchecked = runIdentity({ team, referenced: [] });
  if (referenced.length === 0) return { ...unchecked, isChecking: false };
  if (resolution.status === "resolving") {
    return { ...unchecked, isChecking: true };
  }
  if (!shouldCheck) return { ...unchecked, isChecking: false };
  if (yourSecrets.isPending || (team && teamSecrets.isPending)) {
    return { ...unchecked, isChecking: true };
  }

  return {
    ...runIdentity({
      team,
      referenced,
      yourSecrets: yourSecrets.data,
      teamSecrets: team ? teamSecrets.data : undefined,
    }),
    isChecking: false,
  };
}

interface RunAsChoice {
  teamId: string | undefined;
  runAs: RunAs | undefined;
}

export function useRunAsChoice(identity: RunIdentity) {
  const [choice, setChoice] = useState<RunAsChoice>();
  const teamId = identity.team?.id;
  const runAsChosen =
    choice && choice.teamId === teamId ? choice.runAs : undefined;

  return {
    runAs: runAsFor(identity, runAsChosen),
    choose: (runAs: RunAs | undefined) => setChoice({ teamId, runAs }),
  };
}

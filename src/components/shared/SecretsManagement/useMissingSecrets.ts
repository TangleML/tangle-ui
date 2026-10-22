import { useQuery } from "@tanstack/react-query";

import { actingTeamId } from "@/services/teams/teamResolution";
import type { TeamResolution } from "@/services/teams/types";

import { missingSecretNames, referencedSecretNames } from "./secretReferences";
import { secretsListQuery } from "./secretsStorage";

interface MissingSecrets {
  missing: string[];
  isChecking: boolean;
}

export function useMissingSecrets(
  resolution: TeamResolution,
  sources: readonly unknown[],
): MissingSecrets {
  const referenced = referencedSecretNames(...sources);
  const settled =
    resolution.status !== "resolving" && resolution.status !== "conflict";
  const shouldCheck = settled && referenced.length > 0;

  const { data: secrets, isPending } = useQuery({
    ...secretsListQuery(actingTeamId(resolution)),
    enabled: shouldCheck,
  });

  if (referenced.length === 0) return { missing: [], isChecking: false };
  if (resolution.status === "resolving")
    return { missing: [], isChecking: true };
  if (!shouldCheck) return { missing: [], isChecking: false };
  if (isPending) return { missing: [], isChecking: true };
  if (!secrets) return { missing: [], isChecking: false };

  return {
    missing: missingSecretNames(referenced, secrets),
    isChecking: false,
  };
}

import type { TeamSummary } from "@/services/teams/types";

import { missingSecretNames } from "./secretReferences";
import type { Secret } from "./types";

export type RunAs = "you" | "team";

export type RunAsRule =
  | { kind: "open"; defaultAs: RunAs }
  | { kind: "team-required"; teamOnly: string[] }
  | { kind: "split"; yoursOnly: string[]; teamOnly: string[] };

export interface RunIdentity {
  team: TeamSummary | undefined;
  rule: RunAsRule;
  missing: Record<RunAs, string[]>;
}

interface RunIdentityInputs {
  team: TeamSummary | undefined;
  referenced: readonly string[];
  yourSecrets?: readonly Pick<Secret, "name">[];
  teamSecrets?: readonly Pick<Secret, "name">[];
}

function ruleFor(
  missingFromYours: string[],
  missingFromTeam: string[] | undefined,
): RunAsRule {
  if (!missingFromTeam) return { kind: "open", defaultAs: "you" };

  const teamOnly = missingFromYours.filter(
    (name) => !missingFromTeam.includes(name),
  );
  const yoursOnly = missingFromTeam.filter(
    (name) => !missingFromYours.includes(name),
  );

  if (teamOnly.length === 0) return { kind: "open", defaultAs: "you" };
  if (yoursOnly.length > 0) return { kind: "split", yoursOnly, teamOnly };
  if (missingFromTeam.length === 0) {
    return { kind: "team-required", teamOnly };
  }
  return { kind: "open", defaultAs: "team" };
}

export function runIdentity({
  team,
  referenced,
  yourSecrets,
  teamSecrets,
}: RunIdentityInputs): RunIdentity {
  const missingFromYours = yourSecrets
    ? missingSecretNames(referenced, yourSecrets)
    : [];
  const missingFromTeam =
    team && teamSecrets
      ? missingSecretNames(referenced, teamSecrets)
      : undefined;

  return {
    team,
    rule: ruleFor(missingFromYours, missingFromTeam),
    missing: { you: missingFromYours, team: missingFromTeam ?? [] },
  };
}

export function runAsFor(identity: RunIdentity, choice?: RunAs): RunAs {
  if (!identity.team) return "you";
  const { rule } = identity;
  if (rule.kind === "team-required") return "team";
  if (choice) return choice;
  return rule.kind === "open" ? rule.defaultAs : "you";
}

export function teamIdFor(
  identity: RunIdentity,
  runAs: RunAs,
): string | undefined {
  return runAs === "team" ? identity.team?.id : undefined;
}

export function needsReview(identity: RunIdentity): boolean {
  return (
    identity.rule.kind === "split" ||
    identity.missing[runAsFor(identity)].length > 0
  );
}

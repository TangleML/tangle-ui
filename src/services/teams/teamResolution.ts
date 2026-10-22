import { TeamImpersonationError } from "./errors";
import type {
  TeamAccess,
  TeamIdentity,
  TeamMembership,
  TeamResolution,
  TeamSummary,
} from "./types";

interface LookupState {
  isPending: boolean;
  error: Error | null;
}

interface LoadedState<TData> {
  data: TData | undefined;
  error: Error | null;
}

interface TeamResolutionInputs {
  lookups: LookupState[];
  teams: TeamSummary[];
  memberships: LoadedState<TeamMembership[]>;
  identity: LoadedState<TeamIdentity>;
}

export function teamAccess(teamId: string, identity: TeamIdentity): TeamAccess {
  if (identity.id !== teamId || !identity.permissions.includes("read")) {
    return "none";
  }
  return identity.permissions.includes("write") ? "write" : "read";
}

export function resolveTeam({
  lookups,
  teams,
  memberships,
  identity,
}: TeamResolutionInputs): TeamResolution {
  const failedLookup = lookups.find((lookup) => lookup.error !== null);
  if (failedLookup?.error) {
    return { status: "error", error: failedLookup.error };
  }
  if (lookups.some((lookup) => lookup.isPending)) {
    return { status: "resolving" };
  }

  if (teams.length === 0) return { status: "none" };
  if (teams.length > 1) return { status: "conflict", teams };
  const [team] = teams;

  if (memberships.error) return { status: "error", error: memberships.error };
  if (!memberships.data) return { status: "resolving" };
  if (!memberships.data.some((membership) => membership.teamId === team.id)) {
    return { status: "not-member", team };
  }

  if (identity.error instanceof TeamImpersonationError) {
    return { status: "unavailable", team };
  }
  if (identity.error) return { status: "error", error: identity.error };
  if (!identity.data) return { status: "resolving" };

  const access = teamAccess(team.id, identity.data);
  if (access === "none") return { status: "unavailable", team };
  return { status: "active", team: { ...team, canWrite: access === "write" } };
}

export function actingTeamId(resolution: TeamResolution): string | undefined {
  return resolution.status === "active" ? resolution.team.id : undefined;
}

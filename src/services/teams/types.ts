export interface TeamMembership {
  teamId: string;
  roles: string[];
}

export interface TeamIdentity {
  id: string | null;
  permissions: string[];
}

export type TeamAccess = "none" | "read" | "write";

export interface TeamSummary {
  id: string;
  label: string;
}

interface ActiveTeam extends TeamSummary {
  canWrite: boolean;
}

export type TeamResolution =
  | { status: "none" }
  | { status: "resolving" }
  | { status: "active"; team: ActiveTeam }
  | { status: "not-member"; team: TeamSummary }
  | { status: "unavailable"; team: TeamSummary }
  | { status: "conflict"; teams: TeamSummary[] }
  | { status: "error"; error: Error };

export const TeamsQueryKeys = {
  Identity: (teamId: string) => ["teams", teamId, "identity"] as const,
} as const;

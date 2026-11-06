import { getTeamImpersonationHeaderName } from "@/config/teamImpersonation";

export function teamRequestHeaders(
  teamId: string | undefined,
): Record<string, string> {
  const headerName = getTeamImpersonationHeaderName();
  if (!headerName || !teamId) return {};
  return { [headerName]: teamId };
}

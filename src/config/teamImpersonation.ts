import { isRecord } from "@/utils/typeGuards";

interface TeamImpersonationConfig {
  headerName: string;
}

declare global {
  interface Window {
    __TANGLE_TEAM_IMPERSONATION__?: TeamImpersonationConfig;
  }
}

const HTTP_HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function getTeamImpersonationHeaderName(): string | null {
  if (typeof window === "undefined") return null;

  const config = window.__TANGLE_TEAM_IMPERSONATION__;
  if (!isRecord(config) || typeof config.headerName !== "string") return null;

  const headerName = config.headerName.trim();
  return HTTP_HEADER_NAME.test(headerName) ? headerName : null;
}

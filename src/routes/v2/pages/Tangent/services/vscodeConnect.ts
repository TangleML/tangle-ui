import type { TangentEnvironment } from "@/routes/v2/pages/Tangent/services/listTangentEnvironments";

const EXTENSION_ID = "tangent.tangent-local-agent";

// The extension connects as `vscode-<hostId>`, prefixed with `<sessionId>:`
// once it is attached to a session.
const VSCODE_ENVIRONMENT_MARKER = "vscode-";

export function isVscodeEnvironment(environment: TangentEnvironment): boolean {
  return environment.environmentId.includes(VSCODE_ENVIRONMENT_MARKER);
}

export interface ConnectUrlParams {
  shellUrl: string;
  apiUrl?: string;
  projectId?: string;
  projectName?: string;
}

function buildConnectUrl(
  scheme: "vscode" | "cursor",
  { shellUrl, apiUrl, projectId, projectName }: ConnectUrlParams,
): string {
  const query = new URLSearchParams({ url: shellUrl });
  if (apiUrl) query.set("apiUrl", apiUrl);
  if (projectId) query.set("projectId", projectId);
  if (projectName) query.set("projectName", projectName);
  return `${scheme}://${EXTENSION_ID}/connect?${query.toString()}`;
}

export function buildVscodeConnectUrl(params: ConnectUrlParams): string {
  return buildConnectUrl("vscode", params);
}

export function buildCursorConnectUrl(params: ConnectUrlParams): string {
  return buildConnectUrl("cursor", params);
}

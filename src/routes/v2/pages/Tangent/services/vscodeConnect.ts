import type { TangentEnvironment } from "@/routes/v2/pages/Tangent/services/listTangentEnvironments";

const EXTENSION_ID = "tangent.tangent-local-agent";

const BROWSER_EDITOR = "browser";

// The extension reports the editor it runs in via `metadata.editor` (from
// `vscode.env.appName`); browser hosts report `"browser"`. Its host id is
// `vscode-<hostId>-<projectId>`, which is unreliable to match on because other
// hosts can carry the same substring.
export function isVscodeEnvironment(environment: TangentEnvironment): boolean {
  const editor = environment.metadata?.editor;
  return editor !== undefined && editor !== BROWSER_EDITOR;
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

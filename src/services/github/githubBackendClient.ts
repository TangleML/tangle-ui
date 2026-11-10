import { USER_SETTINGS_PATH } from "@/utils/constants";
import {
  fetchWithErrorHandling,
  RemoteAuthError,
} from "@/utils/fetchWithErrorHandling";
import { getErrorMessage } from "@/utils/string";

const TOKEN_STATUS_PATH = "/api/github/token_status";
const GRANTS_PATH = "/api/github/repository_grants";
const TOKEN_SECRET_SETTING = "github_token_secret_name";

const TOKEN_STATES = [
  "not_configured",
  "secret_missing",
  "invalid",
  "valid",
] as const;
const TOKEN_KINDS = ["fine_grained", "classic", "other"] as const;

export type GitHubTokenState = (typeof TOKEN_STATES)[number];
type GitHubTokenKind = (typeof TOKEN_KINDS)[number];

export interface GitHubTokenStatus {
  secretName: string | null;
  state: GitHubTokenState;
  login: string | null;
  tokenKind: GitHubTokenKind | null;
}

export type GitHubTokenSupport =
  { supported: false } | { supported: true; status: GitHubTokenStatus };

export interface RepositoryGrant {
  id: string;
  owner: string;
  repo: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: Date;
}

export type RepositoryRefKind = "branch" | "tag";

export class GitHubBackendError extends Error {
  name = "GitHubBackendError";
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly detail: string | null,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const stringOrNull = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;

function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function unreadable(what: string) {
  return new Error(`The backend sent ${what} this version can't read.`);
}

async function errorFrom(response: Response): Promise<GitHubBackendError> {
  const body: unknown = await response.json().catch(() => null);
  const fields = isRecord(body) && isRecord(body.detail) ? body.detail : body;
  const detail = isRecord(fields) ? stringOrNull(fields.detail) : null;
  const code = isRecord(fields) ? stringOrNull(fields.code) : null;

  return new GitHubBackendError(
    detail ?? `The backend answered with status ${response.status}.`,
    response.status,
    code,
    detail,
  );
}

async function request(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "manual", ...init });
  } catch (error) {
    throw new GitHubBackendError(
      `Couldn't reach the backend: ${getErrorMessage(error)}`,
      0,
      null,
      null,
    );
  }

  if (response.type === "opaqueredirect") {
    throw new RemoteAuthError(url);
  }
  if (!response.ok) {
    throw await errorFrom(response);
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

const isMissingRoute = (error: unknown) =>
  error instanceof GitHubBackendError &&
  error.status === 404 &&
  error.code === null;

function parseTokenStatus(body: unknown): GitHubTokenStatus {
  const state = isRecord(body) ? oneOf(TOKEN_STATES, body.state) : null;
  if (!isRecord(body) || state === null) {
    throw unreadable("a GitHub token status");
  }

  return {
    secretName: stringOrNull(body.secret_name),
    state,
    login: stringOrNull(body.login),
    tokenKind: oneOf(TOKEN_KINDS, body.token_kind),
  };
}

function parseTimestamp(value: string) {
  return new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(value) ? value : `${value}Z`);
}

function parseGrant(value: unknown): RepositoryGrant {
  if (!isRecord(value)) throw unreadable("a repository grant");

  const id =
    typeof value.id === "number" ? String(value.id) : stringOrNull(value.id);
  const owner = stringOrNull(value.owner);
  const repo = stringOrNull(value.repo);
  const defaultBranch = stringOrNull(value.default_branch);
  const createdAt = stringOrNull(value.created_at);
  if (
    id === null ||
    owner === null ||
    repo === null ||
    defaultBranch === null ||
    createdAt === null ||
    typeof value.private !== "boolean"
  ) {
    throw unreadable("a repository grant");
  }

  return {
    id,
    owner,
    repo,
    isPrivate: value.private,
    defaultBranch,
    createdAt: parseTimestamp(createdAt),
  };
}

export async function fetchGitHubTokenStatus(
  backendUrl: string,
): Promise<GitHubTokenSupport> {
  try {
    const body = await request(`${backendUrl}${TOKEN_STATUS_PATH}`);
    return { supported: true, status: parseTokenStatus(body) };
  } catch (error) {
    if (isMissingRoute(error)) return { supported: false };
    throw error;
  }
}

export async function fetchTokenSecretName(
  backendUrl: string,
): Promise<string | null> {
  const query = new URLSearchParams({ setting_names: TOKEN_SECRET_SETTING });
  const body: unknown = await fetchWithErrorHandling(
    `${backendUrl}${USER_SETTINGS_PATH}?${query}`,
  );
  const settings =
    isRecord(body) && isRecord(body.settings) ? body.settings : {};
  return stringOrNull(settings[TOKEN_SECRET_SETTING]);
}

export async function chooseTokenSecret(
  backendUrl: string,
  secretName: string,
) {
  await fetchWithErrorHandling(`${backendUrl}${USER_SETTINGS_PATH}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: { [TOKEN_SECRET_SETTING]: secretName } }),
  });
}

export async function clearTokenSecret(backendUrl: string) {
  const query = new URLSearchParams({ setting_names: TOKEN_SECRET_SETTING });
  await fetchWithErrorHandling(`${backendUrl}${USER_SETTINGS_PATH}?${query}`, {
    method: "DELETE",
  });
}

export async function createRepositoryGrant(
  backendUrl: string,
  repository: { owner: string; repo: string },
): Promise<RepositoryGrant> {
  const body = await request(`${backendUrl}${GRANTS_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(repository),
  });
  return parseGrant(body);
}

export async function listRepositoryGrants(
  backendUrl: string,
): Promise<RepositoryGrant[]> {
  const body = await request(`${backendUrl}${GRANTS_PATH}`);
  if (!isRecord(body) || !Array.isArray(body.grants)) {
    throw unreadable("a list of repository grants");
  }
  return body.grants.map(parseGrant);
}

export async function revokeRepositoryGrant(
  backendUrl: string,
  grantId: string,
) {
  await request(`${backendUrl}${GRANTS_PATH}/${encodeURIComponent(grantId)}`, {
    method: "DELETE",
  });
}

export async function repositoryRefExists(
  backendUrl: string,
  grantId: string,
  kind: RepositoryRefKind,
  name: string,
): Promise<boolean> {
  const query = new URLSearchParams({ kind, name });
  const body = await request(
    `${backendUrl}${GRANTS_PATH}/${encodeURIComponent(grantId)}/ref_exists?${query}`,
  );
  if (!isRecord(body) || typeof body.exists !== "boolean") {
    throw unreadable("a ref lookup");
  }
  return body.exists;
}

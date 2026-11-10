import { backendRepositorySource } from "./backendRepositorySource";
import type {
  GitHubTokenState,
  GitHubTokenSupport,
} from "./githubBackendClient";
import {
  anonymousRepositorySource,
  parseRepositoryUrl,
  RepositoryLinkError,
  type RepositoryLocation,
  resolveRepositoryUrl,
  TOKEN_UNUSABLE_MESSAGE,
} from "./repositoryUrl";

const NOT_VISIBLE_WITHOUT_TOKEN_MESSAGE =
  "This repository is private or doesn't exist.";

const NO_TOKEN_SUPPORT: GitHubTokenSupport = { supported: false };

export interface TokenAccess {
  backendUrl: string;
  readTokenSupport: () => Promise<GitHubTokenSupport>;
}

export interface CheckedRepository {
  repository: RepositoryLocation;
  tokensSupported: boolean;
}

const tokenWouldHelp = (error: unknown): error is RepositoryLinkError =>
  error instanceof RepositoryLinkError &&
  (error.problem === "not_visible" || error.problem === "rate_limited");

const tokenRefused = (error: unknown) =>
  error instanceof RepositoryLinkError && error.problem === "token_unusable";

function askingForToken(error: RepositoryLinkError, state: GitHubTokenState) {
  const message =
    error.problem === "not_visible"
      ? NOT_VISIBLE_WITHOUT_TOKEN_MESSAGE
      : error.message;

  return state === "not_configured"
    ? new RepositoryLinkError(error.problem, message, true)
    : new RepositoryLinkError(
        "token_unusable",
        `${message} ${TOKEN_UNUSABLE_MESSAGE}`,
        true,
      );
}

async function tokenSupportOrNone(
  access: TokenAccess | null,
): Promise<GitHubTokenSupport> {
  if (!access) return NO_TOKEN_SUPPORT;
  try {
    return await access.readTokenSupport();
  } catch {
    return NO_TOKEN_SUPPORT;
  }
}

async function resolveAnonymously(
  url: string,
  support: GitHubTokenSupport,
  state: GitHubTokenState | undefined,
) {
  try {
    return await resolveRepositoryUrl(url, anonymousRepositorySource());
  } catch (error) {
    if (!support.supported || !state || !tokenWouldHelp(error)) throw error;
    throw askingForToken(error, state);
  }
}

export async function resolveRepositoryLink(
  url: string,
  access: TokenAccess | null,
): Promise<CheckedRepository> {
  parseRepositoryUrl(url);

  const support = await tokenSupportOrNone(access);
  const tokensSupported = support.supported;
  const state = support.supported ? support.status.state : undefined;

  if (access && state === "valid") {
    try {
      const repository = await resolveRepositoryUrl(
        url,
        backendRepositorySource(access.backendUrl),
      );
      return { repository, tokensSupported };
    } catch (error) {
      if (!tokenRefused(error)) throw error;
      const repository = await resolveAnonymously(url, support, "invalid");
      return { repository, tokensSupported };
    }
  }

  const repository = await resolveAnonymously(url, support, state);
  return { repository, tokensSupported };
}

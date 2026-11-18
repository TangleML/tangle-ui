import {
  createGitHubApiClient,
  GitHubApiError,
} from "@/components/shared/GitHubLibrary/utils/githubApiClient";

const GITHUB_WEB_ORIGIN = "https://github.com";
const DEFAULT_BRANCH_REF = "HEAD";

const SSH_URL = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/;
const OWNER_NAME = /^[A-Za-z0-9-]+$/;
const REPOSITORY_NAME = /^[A-Za-z0-9._-]+$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/i;

const UNRECOGNISED_URL_MESSAGE =
  "That isn't a GitHub repository URL. Paste one like https://github.com/owner/repo, or the URL of a folder in it.";
const NOT_VISIBLE_MESSAGE =
  "This repository is private or doesn't exist. Private repositories aren't supported yet.";
const RATE_LIMITED_MESSAGE =
  "GitHub allows 60 lookups an hour from one network address without signing in, and that limit has been reached. Try again later.";

export interface RepositoryLocation {
  owner: string;
  repo: string;
  ref: string | null;
  path: string | null;
}

type RepositoryLinkProblem =
  "unrecognised_url" | "not_visible" | "unknown_ref" | "rate_limited";

export class RepositoryLinkError extends Error {
  name = "RepositoryLinkError";
  constructor(
    readonly problem: RepositoryLinkProblem,
    message: string,
  ) {
    super(message);
  }
}

export const isProblemWithUrl = (error: unknown) =>
  error instanceof RepositoryLinkError && error.problem !== "rate_limited";

type RepositoryView = "root" | "tree" | "blob";

interface ParsedRepositoryUrl {
  owner: string;
  repo: string;
  view: RepositoryView;
  segments: string[];
}

interface ResolvedRef {
  ref: string | null;
  segmentCount: number;
}

const unrecognisedUrl = () =>
  new RepositoryLinkError("unrecognised_url", UNRECOGNISED_URL_MESSAGE);

export const isCommitSha = (ref: string) => COMMIT_SHA.test(ref);

export const isGitHubWebUrl = (url: string) =>
  url.startsWith(`${GITHUB_WEB_ORIGIN}/`);

function named(owner: string, repo: string) {
  if (
    !OWNER_NAME.test(owner) ||
    !REPOSITORY_NAME.test(repo) ||
    repo === "." ||
    repo === ".."
  ) {
    throw unrecognisedUrl();
  }
  return { owner, repo };
}

function webPathSegments(text: string): string[] {
  try {
    const url = new URL(text);
    if (url.origin !== GITHUB_WEB_ORIGIN || url.username || url.password) {
      throw unrecognisedUrl();
    }
    return url.pathname
      .split("/")
      .filter((segment) => segment !== "")
      .map(decodeURIComponent);
  } catch {
    throw unrecognisedUrl();
  }
}

function parseRepositoryUrl(input: string): ParsedRepositoryUrl {
  const text = input.trim();

  const ssh = SSH_URL.exec(text);
  if (ssh) {
    return { ...named(ssh[1], ssh[2]), view: "root", segments: [] };
  }

  const [owner, repoSegment, view, ...segments] = webPathSegments(text);
  if (owner === undefined || repoSegment === undefined) {
    throw unrecognisedUrl();
  }

  if (view === undefined) {
    return {
      ...named(owner, repoSegment.replace(/\.git$/, "")),
      view: "root",
      segments: [],
    };
  }

  const leastSegments = view === "blob" ? 2 : 1;
  if ((view !== "tree" && view !== "blob") || segments.length < leastSegments) {
    throw unrecognisedUrl();
  }

  return { ...named(owner, repoSegment), view, segments };
}

function linkErrorFrom(error: unknown) {
  return error instanceof GitHubApiError && error.rateLimited
    ? new RepositoryLinkError("rate_limited", RATE_LIMITED_MESSAGE)
    : error;
}

async function askGitHub<T>(lookup: Promise<T>): Promise<T> {
  try {
    return await lookup;
  } catch (error) {
    throw linkErrorFrom(error);
  }
}

async function visibleRepository(
  client: ReturnType<typeof createGitHubApiClient>,
  owner: string,
  repo: string,
) {
  try {
    return await client.getRepository(`${owner}/${repo}`);
  } catch (error) {
    if (error instanceof GitHubApiError && error.statusCode === 404) {
      throw new RepositoryLinkError("not_visible", NOT_VISIBLE_MESSAGE);
    }
    throw linkErrorFrom(error);
  }
}

async function resolveRef(
  client: ReturnType<typeof createGitHubApiClient>,
  fullName: string,
  defaultBranch: string,
  segments: string[],
): Promise<ResolvedRef> {
  const [first] = segments;
  if (first === DEFAULT_BRANCH_REF) {
    return { ref: null, segmentCount: 1 };
  }
  if (isCommitSha(first)) {
    return { ref: first.toLowerCase(), segmentCount: 1 };
  }

  const longestFirst = segments.map((_, index) => {
    const segmentCount = segments.length - index;
    return { ref: segments.slice(0, segmentCount).join("/"), segmentCount };
  });

  const defaultBranchPrefix = longestFirst.find(
    (candidate) => candidate.ref === defaultBranch,
  );
  if (defaultBranchPrefix) {
    return defaultBranchPrefix;
  }

  for (const candidate of longestFirst) {
    if (await askGitHub(client.branchExists(fullName, candidate.ref))) {
      return candidate;
    }
  }
  for (const candidate of longestFirst) {
    if (await askGitHub(client.tagExists(fullName, candidate.ref))) {
      return candidate;
    }
  }

  throw new RepositoryLinkError(
    "unknown_ref",
    `${fullName} has no branch or tag that matches this URL. To link a commit, use its full 40-character hash.`,
  );
}

export async function resolveRepositoryUrl(
  input: string,
): Promise<RepositoryLocation> {
  const parsed = parseRepositoryUrl(input);
  const client = createGitHubApiClient();
  const repository = await visibleRepository(client, parsed.owner, parsed.repo);

  const owner = repository.owner.login;
  const repo = repository.name;
  if (parsed.view === "root") {
    return { owner, repo, ref: null, path: null };
  }

  const fileSegmentCount = parsed.view === "blob" ? 1 : 0;
  const lastFolderIndex = parsed.segments.length - fileSegmentCount;
  const { ref, segmentCount } = await resolveRef(
    client,
    `${owner}/${repo}`,
    repository.default_branch,
    parsed.segments.slice(0, lastFolderIndex),
  );
  const folder = parsed.segments.slice(segmentCount, lastFolderIndex);

  return {
    owner,
    repo,
    ref,
    path: folder.length > 0 ? folder.join("/") : null,
  };
}

export function repositoryUrl({
  owner,
  repo,
  ref,
  path,
}: RepositoryLocation): string {
  const base = `${GITHUB_WEB_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  if (ref === null && path === null) {
    return base;
  }

  const treeSegments = [ref ?? DEFAULT_BRANCH_REF, path]
    .flatMap((part) => (part ? part.split("/") : []))
    .map(encodeURIComponent);
  return `${base}/tree/${treeSegments.join("/")}`;
}

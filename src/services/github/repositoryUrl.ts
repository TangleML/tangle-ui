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
export const TOKEN_UNUSABLE_MESSAGE =
  "Your GitHub token can't be used right now.";
const RATE_LIMITED_MESSAGE =
  "GitHub allows 60 lookups an hour from one network address without signing in, and that limit has been reached. Try again later.";

export interface RepositoryLocation {
  owner: string;
  repo: string;
  ref: string | null;
  path: string | null;
  isPrivate: boolean;
  grantId?: string;
}

type RepositoryAddress = Pick<
  RepositoryLocation,
  "owner" | "repo" | "ref" | "path"
>;

export interface VisibleRepository {
  owner: string;
  repo: string;
  defaultBranch: string;
  grant?: { id: string; isPrivate: boolean };
}

export interface RepositorySource {
  getRepository(owner: string, repo: string): Promise<VisibleRepository>;
  branchExists(repository: VisibleRepository, branch: string): Promise<boolean>;
  tagExists(repository: VisibleRepository, tag: string): Promise<boolean>;
}

export type RepositoryLinkProblem =
  | "unrecognised_url"
  | "not_visible"
  | "unknown_ref"
  | "rate_limited"
  | "token_unusable";

export class RepositoryLinkError extends Error {
  name = "RepositoryLinkError";
  constructor(
    readonly problem: RepositoryLinkProblem,
    message: string,
    readonly needsToken = false,
  ) {
    super(message);
  }
}

const PROBLEMS_NOT_WITH_URL: readonly RepositoryLinkProblem[] = [
  "rate_limited",
  "token_unusable",
];

export const isProblemWithUrl = (error: unknown) =>
  error instanceof RepositoryLinkError &&
  !PROBLEMS_NOT_WITH_URL.includes(error.problem);

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

export function parseRepositoryUrl(input: string): ParsedRepositoryUrl {
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

const fullNameOf = ({ owner, repo }: VisibleRepository) => `${owner}/${repo}`;

export function anonymousRepositorySource(): RepositorySource {
  const client = createGitHubApiClient();

  return {
    async getRepository(owner, repo) {
      try {
        const found = await client.getRepository(`${owner}/${repo}`);
        return {
          owner: found.owner.login,
          repo: found.name,
          defaultBranch: found.default_branch,
        };
      } catch (error) {
        if (error instanceof GitHubApiError && error.statusCode === 404) {
          throw new RepositoryLinkError("not_visible", NOT_VISIBLE_MESSAGE);
        }
        throw linkErrorFrom(error);
      }
    },
    branchExists: (repository, branch) =>
      askGitHub(client.branchExists(fullNameOf(repository), branch)),
    tagExists: (repository, tag) =>
      askGitHub(client.tagExists(fullNameOf(repository), tag)),
  };
}

async function resolveRef(
  source: RepositorySource,
  repository: VisibleRepository,
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
    (candidate) => candidate.ref === repository.defaultBranch,
  );
  if (defaultBranchPrefix) {
    return defaultBranchPrefix;
  }

  for (const candidate of longestFirst) {
    if (await source.branchExists(repository, candidate.ref)) {
      return candidate;
    }
  }
  for (const candidate of longestFirst) {
    if (await source.tagExists(repository, candidate.ref)) {
      return candidate;
    }
  }

  throw new RepositoryLinkError(
    "unknown_ref",
    `${fullNameOf(repository)} has no branch or tag that matches this URL. To link a commit, use its full 40-character hash.`,
  );
}

export async function resolveRepositoryUrl(
  input: string,
  source: RepositorySource,
): Promise<RepositoryLocation> {
  const parsed = parseRepositoryUrl(input);
  const repository = await source.getRepository(parsed.owner, parsed.repo);

  const { owner, repo, grant } = repository;
  const access = grant
    ? { isPrivate: grant.isPrivate, grantId: grant.id }
    : { isPrivate: false };
  if (parsed.view === "root") {
    return { owner, repo, ref: null, path: null, ...access };
  }

  const fileSegmentCount = parsed.view === "blob" ? 1 : 0;
  const lastFolderIndex = parsed.segments.length - fileSegmentCount;
  const { ref, segmentCount } = await resolveRef(
    source,
    repository,
    parsed.segments.slice(0, lastFolderIndex),
  );
  const folder = parsed.segments.slice(segmentCount, lastFolderIndex);

  return {
    owner,
    repo,
    ref,
    path: folder.length > 0 ? folder.join("/") : null,
    ...access,
  };
}

export function repositoryUrl({
  owner,
  repo,
  ref,
  path,
}: RepositoryAddress): string {
  const base = `${GITHUB_WEB_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  if (ref === null && path === null) {
    return base;
  }

  const treeSegments = [ref ?? DEFAULT_BRANCH_REF, path]
    .flatMap((part) => (part ? part.split("/") : []))
    .map(encodeURIComponent);
  return `${base}/tree/${treeSegments.join("/")}`;
}

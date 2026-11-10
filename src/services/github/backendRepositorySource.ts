import {
  createRepositoryGrant,
  GitHubBackendError,
  repositoryRefExists,
  type RepositoryRefKind,
} from "./githubBackendClient";
import {
  RepositoryLinkError,
  type RepositoryLinkProblem,
  type RepositorySource,
  TOKEN_UNUSABLE_MESSAGE,
  type VisibleRepository,
} from "./repositoryUrl";

interface BackendProblem {
  problem: RepositoryLinkProblem;
  message: string;
}

const TOKEN_UNUSABLE: BackendProblem = {
  problem: "token_unusable",
  message: TOKEN_UNUSABLE_MESSAGE,
};

const BACKEND_PROBLEMS: Record<string, BackendProblem> = {
  not_visible: {
    problem: "not_visible",
    message:
      "Your GitHub token can't see this repository. If it's private, give the token access to it on GitHub.",
  },
  github_rate_limited: {
    problem: "rate_limited",
    message:
      "GitHub is limiting the lookups made with your token. Try again later.",
  },
  no_token: TOKEN_UNUSABLE,
  token_invalid: TOKEN_UNUSABLE,
};

function linkErrorFrom(error: unknown) {
  const known =
    error instanceof GitHubBackendError && error.code
      ? BACKEND_PROBLEMS[error.code]
      : undefined;
  return known
    ? new RepositoryLinkError(
        known.problem,
        known.message,
        known.problem === "token_unusable",
      )
    : error;
}

async function askBackend<T>(lookup: Promise<T>): Promise<T> {
  try {
    return await lookup;
  } catch (error) {
    throw linkErrorFrom(error);
  }
}

function grantIdOf(repository: VisibleRepository) {
  if (!repository.grant) {
    throw new Error(
      `${repository.owner}/${repository.repo} was not looked up through the backend.`,
    );
  }
  return repository.grant.id;
}

export function backendRepositorySource(backendUrl: string): RepositorySource {
  const refExists = (
    repository: VisibleRepository,
    kind: RepositoryRefKind,
    name: string,
  ) =>
    askBackend(
      repositoryRefExists(backendUrl, grantIdOf(repository), kind, name),
    );

  return {
    async getRepository(owner, repo) {
      const grant = await askBackend(
        createRepositoryGrant(backendUrl, { owner, repo }),
      );
      return {
        owner: grant.owner,
        repo: grant.repo,
        defaultBranch: grant.defaultBranch,
        grant: { id: grant.id, isPrivate: grant.isPrivate },
      };
    },
    branchExists: (repository, branch) =>
      refExists(repository, "branch", branch),
    tagExists: (repository, tag) => refExists(repository, "tag", tag),
  };
}

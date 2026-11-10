import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GitHubTokenState,
  GitHubTokenSupport,
} from "./githubBackendClient";
import { RepositoryLinkError } from "./repositoryUrl";
import { resolveRepositoryLink } from "./resolveRepositoryLink";

const BACKEND = "http://backend.test";
const GRANTS = `${BACKEND}/api/github/repository_grants`;
const GITHUB_REPO = "https://api.github.com/repos/TangleML/pipeline_components";
const REPO_URL = "https://github.com/TangleML/pipeline_components";
const NOT_VISIBLE_ANONYMOUSLY =
  "This repository is private or doesn't exist. Private repositories aren't supported yet.";

const fetchMock = vi.fn<typeof fetch>();
const replies = new Map<string, () => Response>();

const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status });

const PUBLIC_ON_GITHUB = json(200, {
  name: "pipeline_components",
  default_branch: "master",
  owner: { login: "TangleML" },
});

const grantReply = (isPrivate: boolean) =>
  json(200, {
    id: "7",
    owner: "TangleML",
    repo: "pipeline_components",
    private: isPrivate,
    default_branch: "master",
    created_at: "2026-11-10T09:00:00Z",
  });

function reply(method: string, url: string, answer: () => Response) {
  replies.set(`${method} ${url}`, answer);
}

const supported = (state: GitHubTokenState): GitHubTokenSupport => ({
  supported: true,
  status: { secretName: "GITHUB_TOKEN", state, login: null, tokenKind: null },
});

const access = (readTokenSupport: () => Promise<GitHubTokenSupport>) => ({
  backendUrl: BACKEND,
  readTokenSupport,
});

const withToken = (state: GitHubTokenState) =>
  access(async () => supported(state));

async function linkError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RepositoryLinkError) return error;
    throw error;
  }
  throw new Error("Expected the link to fail");
}

const requested = (prefix: string) =>
  fetchMock.mock.calls
    .map(([input, init]) => `${init?.method ?? "GET"} ${String(input)}`)
    .filter((call) => call.includes(prefix));

describe("resolveRepositoryLink", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input, init) => {
      const answer = replies.get(`${init?.method ?? "GET"} ${String(input)}`);
      return answer ? answer() : json(404, { message: "Not Found" })();
    });
  });

  afterEach(() => {
    replies.clear();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe("without a usable token", () => {
    it("links a public repository anonymously when there is no backend", async () => {
      reply("GET", GITHUB_REPO, PUBLIC_ON_GITHUB);

      await expect(resolveRepositoryLink(REPO_URL, null)).resolves.toEqual({
        repository: {
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          isPrivate: false,
        },
        tokensSupported: false,
      });
    });

    it("says what it said before when the backend has no GitHub tokens", async () => {
      const error = await linkError(
        resolveRepositoryLink(
          REPO_URL,
          access(async () => ({ supported: false })),
        ),
      );

      expect(error.message).toBe(NOT_VISIBLE_ANONYMOUSLY);
      expect(error.needsToken).toBe(false);
      expect(requested(BACKEND)).toEqual([]);
    });

    it("treats a token status it can't read as no token support", async () => {
      const error = await linkError(
        resolveRepositoryLink(
          REPO_URL,
          access(async () => {
            throw new Error("backend down");
          }),
        ),
      );

      expect(error.message).toBe(NOT_VISIBLE_ANONYMOUSLY);
    });

    it("links a public repository anonymously when no token is chosen", async () => {
      reply("GET", GITHUB_REPO, PUBLIC_ON_GITHUB);

      const checked = await resolveRepositoryLink(
        REPO_URL,
        withToken("not_configured"),
      );

      expect(checked.repository).not.toHaveProperty("grantId");
      expect(checked.tokensSupported).toBe(true);
      expect(requested(GRANTS)).toEqual([]);
    });

    it("asks for a token when none is chosen and the repository is hidden", async () => {
      const error = await linkError(
        resolveRepositoryLink(REPO_URL, withToken("not_configured")),
      );

      expect(error).toMatchObject({
        problem: "not_visible",
        message: "This repository is private or doesn't exist.",
        needsToken: true,
      });
    });

    it.each(["secret_missing", "invalid"] as const)(
      "says the chosen token can't be used when it is %s",
      async (state) => {
        const error = await linkError(
          resolveRepositoryLink(REPO_URL, withToken(state)),
        );

        expect(error).toMatchObject({
          problem: "token_unusable",
          message:
            "This repository is private or doesn't exist. Your GitHub token can't be used right now.",
          needsToken: true,
        });
        expect(requested(GRANTS)).toEqual([]);
      },
    );
  });

  describe("with a working token", () => {
    it("links a public repository through the backend, keeping its grant", async () => {
      reply("POST", GRANTS, grantReply(false));

      await expect(
        resolveRepositoryLink(REPO_URL, withToken("valid")),
      ).resolves.toEqual({
        repository: {
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          isPrivate: false,
          grantId: "7",
        },
        tokensSupported: true,
      });
      expect(requested("api.github.com")).toEqual([]);
    });

    it("links a private repository through the backend", async () => {
      reply("POST", GRANTS, grantReply(true));

      const { repository } = await resolveRepositoryLink(
        REPO_URL,
        withToken("valid"),
      );

      expect(repository).toMatchObject({ isPrivate: true, grantId: "7" });
    });

    it.each(["no_token", "token_invalid"])(
      "falls back to GitHub without a token when the backend answers %s",
      async (code) => {
        reply("POST", GRANTS, json(409, { detail: "No token", code }));
        reply("GET", GITHUB_REPO, PUBLIC_ON_GITHUB);

        const { repository } = await resolveRepositoryLink(
          REPO_URL,
          withToken("valid"),
        );

        expect(repository).toEqual({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          isPrivate: false,
        });
        expect(requested("api.github.com")).toEqual([`GET ${GITHUB_REPO}`]);
      },
    );

    it("says the token can't be used when the fallback can't see the repository either", async () => {
      reply(
        "POST",
        GRANTS,
        json(409, { detail: "Rejected", code: "token_invalid" }),
      );

      const error = await linkError(
        resolveRepositoryLink(REPO_URL, withToken("valid")),
      );

      expect(error).toMatchObject({
        problem: "token_unusable",
        needsToken: true,
      });
    });

    it("says when the token can't see the repository, without asking GitHub anonymously", async () => {
      reply(
        "POST",
        GRANTS,
        json(404, { detail: "Not visible", code: "not_visible" }),
      );

      const error = await linkError(
        resolveRepositoryLink(REPO_URL, withToken("valid")),
      );

      expect(error.message).toBe(
        "Your GitHub token can't see this repository. If it's private, give the token access to it on GitHub.",
      );
      expect(requested("api.github.com")).toEqual([]);
    });

    it("passes on a backend failure it has no words for", async () => {
      reply(
        "POST",
        GRANTS,
        json(502, { detail: "GitHub is down", code: "github_unavailable" }),
      );

      await expect(
        resolveRepositoryLink(REPO_URL, withToken("valid")),
      ).rejects.toMatchObject({
        name: "GitHubBackendError",
        code: "github_unavailable",
        message: "GitHub is down",
      });
    });
  });

  it("does not read the token status for a URL that isn't GitHub's", async () => {
    const readTokenSupport = vi.fn(async () => supported("valid"));

    const error = await linkError(
      resolveRepositoryLink(
        "https://gitlab.com/TangleML/x",
        access(readTokenSupport),
      ),
    );

    expect(error.problem).toBe("unrecognised_url");
    expect(readTokenSupport).not.toHaveBeenCalled();
  });
});

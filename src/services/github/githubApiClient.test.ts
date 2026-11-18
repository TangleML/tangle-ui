import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGitHubApiClient, GitHubApiError } from "./githubApiClient";

const fetchMock = vi.fn<typeof fetch>();

function respond(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers }),
  );
}

const requestedUrl = () => String(fetchMock.mock.calls[0][0]);
const requestedHeaders = () => fetchMock.mock.calls[0][1]?.headers;

async function failureOf(request: Promise<unknown>) {
  try {
    await request;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the request to fail");
}

describe("createGitHubApiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    respond(200);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("sends the token it was given", async () => {
    await createGitHubApiClient("ghp_token").getRepository("o/r");

    expect(requestedHeaders()).toMatchObject({
      Authorization: "Bearer ghp_token",
    });
  });

  it("asks anonymously when it has no token", async () => {
    await createGitHubApiClient().getRepository("o/r");

    expect(requestedHeaders()).not.toHaveProperty("Authorization");
    expect(requestedHeaders()).toMatchObject({
      Accept: "application/vnd.github.v3+json",
    });
  });

  describe("checkAccess", () => {
    it("is true of a repository it can read", async () => {
      await expect(createGitHubApiClient("t").checkAccess("o/r")).resolves.toBe(
        true,
      );
      expect(requestedUrl()).toBe("https://api.github.com/repos/o/r");
    });

    it("is false of one it cannot", async () => {
      respond(404, { message: "Not Found" });

      await expect(createGitHubApiClient("t").checkAccess("o/r")).resolves.toBe(
        false,
      );
    });

    it("passes on any other failure", async () => {
      respond(401, { message: "Bad credentials" });

      await expect(
        createGitHubApiClient("t").checkAccess("o/r"),
      ).rejects.toThrow("Bad credentials");
    });
  });

  describe("branchExists", () => {
    it("looks up the branch's exact ref", async () => {
      await expect(
        createGitHubApiClient().branchExists("o/r", "feature/a#b"),
      ).resolves.toBe(true);
      expect(requestedUrl()).toBe(
        "https://api.github.com/repos/o/r/git/ref/heads/feature/a%23b",
      );
    });

    it("is false of a branch the repository does not have", async () => {
      respond(404, { message: "Not Found" });

      await expect(
        createGitHubApiClient().branchExists("o/r", "gone"),
      ).resolves.toBe(false);
    });
  });

  describe("tagExists", () => {
    it("looks up the tag's exact ref", async () => {
      await expect(
        createGitHubApiClient().tagExists("o/r", "v1.2.0"),
      ).resolves.toBe(true);
      expect(requestedUrl()).toBe(
        "https://api.github.com/repos/o/r/git/ref/tags/v1.2.0",
      );
    });

    it("is false of a tag the repository does not have", async () => {
      respond(404, { message: "Not Found" });

      await expect(
        createGitHubApiClient().tagExists("o/r", "v9"),
      ).resolves.toBe(false);
    });
  });

  describe("rate limits", () => {
    it.each([
      ["a spent hourly allowance", 403, { "x-ratelimit-remaining": "0" }],
      ["a request to wait", 403, { "retry-after": "60" }],
      ["too many requests", 429, {}],
    ])("marks %s as rate limited", async (_, status, headers) => {
      respond(status, { message: "API rate limit exceeded" }, headers);

      const error = await failureOf(
        createGitHubApiClient().getRepository("o/r"),
      );

      expect(error).toBeInstanceOf(GitHubApiError);
      expect(error).toMatchObject({ statusCode: status, rateLimited: true });
    });

    it("does not mark a plain refusal as rate limited", async () => {
      respond(
        403,
        { message: "Resource not accessible" },
        { "x-ratelimit-remaining": "42" },
      );

      const error = await failureOf(
        createGitHubApiClient().getRepository("o/r"),
      );

      expect(error).toMatchObject({ statusCode: 403, rateLimited: false });
    });
  });
});

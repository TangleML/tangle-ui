import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createGitHubApiClient } from "./githubApiClient";

describe("createGitHubApiClient request headers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ default_branch: "main" }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const sentHeaders = (): Record<string, string> =>
    fetchMock.mock.calls[0][1].headers;

  test("sends a Bearer Authorization header when a token is provided", async () => {
    await createGitHubApiClient("my-token").getRepository("owner/repo");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo",
      expect.anything(),
    );
    expect(sentHeaders().Authorization).toBe("Bearer my-token");
  });

  test.each([
    ["an empty string", ""],
    ["undefined", undefined],
  ])(
    "omits the Authorization header when the token is %s",
    async (_, token) => {
      await createGitHubApiClient(token).getRepository("owner/repo");

      expect(sentHeaders()).not.toHaveProperty("Authorization");
    },
  );

  test.each([
    ["a token", "my-token"],
    ["an empty string", ""],
    ["undefined", undefined],
  ])("sends the Accept and API version headers with %s", async (_, token) => {
    await createGitHubApiClient(token).getRepository("owner/repo");

    expect(sentHeaders()).toMatchObject({
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });
});

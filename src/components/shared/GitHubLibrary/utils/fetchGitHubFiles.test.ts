import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchGitHubFiles } from "./fetchGitHubFiles";

const notFoundResponse = {
  ok: false,
  status: 404,
  statusText: "Not Found",
  json: async () => ({ message: "Not Found" }),
};

const okResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

describe("fetchGitHubFiles", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test.each([
    ["an empty string", ""],
    ["whitespace", "   "],
  ])(
    "hints at a private repository when the token is %s and the repository is not found",
    async (_, pat) => {
      fetchMock.mockResolvedValue(notFoundResponse);

      await expect(
        fetchGitHubFiles(pat, "owner/repo", () => true),
      ).rejects.toThrow(
        "Repository not found. If it is private, add a personal access token.",
      );
    },
  );

  test("keeps the existing error when a token is provided and the repository is not found", async () => {
    fetchMock.mockResolvedValue(notFoundResponse);

    await expect(
      fetchGitHubFiles("my-token", "owner/repo", () => true),
    ).rejects.toThrow(new Error("Failed to fetch GitHub files: Not Found"));
  });

  test("returns the matched files without a token when the repository is public", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ default_branch: "main" }))
      .mockResolvedValueOnce(
        okResponse({
          tree: [
            {
              path: "component.yaml",
              type: "blob",
              sha: "abc",
              url: "https://api.github.com/blob/abc",
            },
            {
              path: "README.md",
              type: "blob",
              sha: "def",
              url: "https://api.github.com/blob/def",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okResponse({ content: btoa("name: test") }));

    const files = await fetchGitHubFiles("", "owner/repo", (fileName) =>
      fileName.endsWith(".yaml"),
    );

    expect(files).toEqual([
      {
        repoName: "owner/repo",
        sha: "abc",
        url: "https://github.com/owner/repo/blob/main/component.yaml",
        content: "name: test",
      },
    ]);
  });
});

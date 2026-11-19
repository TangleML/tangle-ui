import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isGitHubWebUrl,
  RepositoryLinkError,
  repositoryUrl,
  resolveRepositoryUrl,
} from "./repositoryUrl";

const API = "https://api.github.com";
const REPO_PATH = "/repos/TangleML/pipeline_components";
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

interface Route {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

const REPOSITORY: Route = {
  body: {
    name: "pipeline_components",
    full_name: "TangleML/pipeline_components",
    default_branch: "master",
    private: false,
    owner: { login: "TangleML" },
  },
};

const FOUND: Route = { body: { ref: "refs/heads/x" } };

const RATE_LIMITED: Route = {
  status: 403,
  body: { message: "API rate limit exceeded for 203.0.113.7." },
  headers: { "x-ratelimit-remaining": "0" },
};

const fetchMock = vi.fn<typeof fetch>();

function github(routes: Record<string, Route>) {
  fetchMock.mockImplementation(async (input) => {
    const path = String(input).replace(API, "");
    const route = routes[path] ?? {
      status: 404,
      body: { message: "Not Found" },
    };
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status ?? 200,
      headers: route.headers,
    });
  });
}

const requestedPaths = () =>
  fetchMock.mock.calls.map(([input]) => String(input).replace(API, ""));

describe("resolveRepositoryUrl", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    github({ [REPO_PATH]: REPOSITORY });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  describe("accepts", () => {
    it.each([
      "https://github.com/TangleML/pipeline_components",
      "https://github.com/TangleML/pipeline_components/",
      "https://github.com/TangleML/pipeline_components.git",
      "https://github.com/TangleML/pipeline_components?tab=readme-ov-file#readme",
      "  https://github.com/TangleML/pipeline_components  ",
      "git@github.com:TangleML/pipeline_components.git",
      "git@github.com:TangleML/pipeline_components",
    ])("%s as the whole repository", async (url) => {
      await expect(resolveRepositoryUrl(url)).resolves.toEqual({
        owner: "TangleML",
        repo: "pipeline_components",
        ref: null,
        path: null,
      });
      expect(requestedPaths()).toEqual([REPO_PATH]);
    });

    it("takes the owner and name as GitHub spells them", async () => {
      github({ "/repos/tangleml/Pipeline_Components": REPOSITORY });

      await expect(
        resolveRepositoryUrl("https://github.com/tangleml/Pipeline_Components"),
      ).resolves.toMatchObject({
        owner: "TangleML",
        repo: "pipeline_components",
      });
    });

    it("a folder on the default branch without looking the branch up", async () => {
      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/master/components/data/",
        ),
      ).resolves.toEqual({
        owner: "TangleML",
        repo: "pipeline_components",
        ref: "master",
        path: "components/data",
      });
      expect(requestedPaths()).toEqual([REPO_PATH]);
    });

    it("a branch with no folder", async () => {
      github({
        [REPO_PATH]: REPOSITORY,
        [`${REPO_PATH}/git/ref/heads/dev`]: FOUND,
      });

      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/dev",
        ),
      ).resolves.toMatchObject({ ref: "dev", path: null });
    });

    it("a branch whose name contains a slash, trying the longest name first", async () => {
      github({
        [REPO_PATH]: REPOSITORY,
        [`${REPO_PATH}/git/ref/heads/feature/new-loader`]: FOUND,
      });

      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/feature/new-loader/components",
        ),
      ).resolves.toMatchObject({
        ref: "feature/new-loader",
        path: "components",
      });
      expect(requestedPaths()).toEqual([
        REPO_PATH,
        `${REPO_PATH}/git/ref/heads/feature/new-loader/components`,
        `${REPO_PATH}/git/ref/heads/feature/new-loader`,
      ]);
    });

    it("a tag, once no branch matches", async () => {
      github({
        [REPO_PATH]: REPOSITORY,
        [`${REPO_PATH}/git/ref/tags/v1.2.0`]: FOUND,
      });

      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/v1.2.0/components",
        ),
      ).resolves.toMatchObject({ ref: "v1.2.0", path: "components" });
      expect(requestedPaths()).toEqual([
        REPO_PATH,
        `${REPO_PATH}/git/ref/heads/v1.2.0/components`,
        `${REPO_PATH}/git/ref/heads/v1.2.0`,
        `${REPO_PATH}/git/ref/tags/v1.2.0/components`,
        `${REPO_PATH}/git/ref/tags/v1.2.0`,
      ]);
    });

    it("a commit without looking it up", async () => {
      await expect(
        resolveRepositoryUrl(
          `https://github.com/TangleML/pipeline_components/tree/${COMMIT.toUpperCase()}/components`,
        ),
      ).resolves.toMatchObject({ ref: COMMIT, path: "components" });
      expect(requestedPaths()).toEqual([REPO_PATH]);
    });

    it("HEAD as the default branch", async () => {
      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/HEAD/components",
        ),
      ).resolves.toMatchObject({ ref: null, path: "components" });
    });

    it("a file by linking the folder it is in", async () => {
      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/blob/master/components/data/component.yaml",
        ),
      ).resolves.toMatchObject({ ref: "master", path: "components/data" });
    });

    it("a file at the top of the repository as the whole branch", async () => {
      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/blob/master/README.md",
        ),
      ).resolves.toMatchObject({ ref: "master", path: null });
    });

    it("an encoded branch name", async () => {
      github({
        [REPO_PATH]: REPOSITORY,
        [`${REPO_PATH}/git/ref/heads/fix%231`]: FOUND,
      });

      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/fix%231/docs",
        ),
      ).resolves.toMatchObject({ ref: "fix#1", path: "docs" });
    });
  });

  describe("rejects", () => {
    it.each([
      "",
      "pipeline_components",
      "github.com/TangleML/pipeline_components",
      "http://github.com/TangleML/pipeline_components",
      "https://gitlab.com/TangleML/pipeline_components",
      "https://www.github.com/TangleML/pipeline_components",
      "https://github.com:8443/TangleML/pipeline_components",
      "https://someone@github.com/TangleML/pipeline_components",
      "https://github.com/TangleML",
      "https://github.com/TangleML/pipeline_components/issues",
      "https://github.com/TangleML/pipeline_components/pull/12",
      "https://github.com/TangleML/pipeline_components/tree",
      "https://github.com/TangleML/pipeline_components/blob/master",
      "https://github.com/Tangle%20ML/pipeline_components",
      "https://github.com/TangleML/%E0%A4%A",
      "git@gitlab.com:TangleML/pipeline_components.git",
    ])("%s without asking GitHub", async (url) => {
      await expect(resolveRepositoryUrl(url)).rejects.toThrow(
        "That isn't a GitHub repository URL. Paste one like https://github.com/owner/repo, or the URL of a folder in it.",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("a repository it cannot see", async () => {
      github({});

      await expect(
        resolveRepositoryUrl("https://github.com/TangleML/secret-sauce"),
      ).rejects.toThrow(
        "This repository is private or doesn't exist. Private repositories aren't supported yet.",
      );
    });

    it("a branch, tag or commit the repository does not have", async () => {
      const result = resolveRepositoryUrl(
        "https://github.com/TangleML/pipeline_components/tree/gone/components",
      );

      await expect(result).rejects.toThrow(RepositoryLinkError);
      await expect(result).rejects.toThrow(
        "TangleML/pipeline_components has no branch or tag that matches this URL. To link a commit, use its full 40-character hash.",
      );
    });

    it.each([
      ["the repository lookup", { [REPO_PATH]: RATE_LIMITED }],
      [
        "a branch lookup",
        {
          [REPO_PATH]: REPOSITORY,
          [`${REPO_PATH}/git/ref/heads/dev`]: RATE_LIMITED,
        },
      ],
    ])("with a rate limit message when %s is refused", async (_, routes) => {
      github(routes);

      await expect(
        resolveRepositoryUrl(
          "https://github.com/TangleML/pipeline_components/tree/dev",
        ),
      ).rejects.toThrow(
        "GitHub allows 60 lookups an hour from one network address without signing in, and that limit has been reached. Try again later.",
      );
    });

    it("passes on a failure that is neither missing nor rate limited", async () => {
      github({
        [REPO_PATH]: { status: 500, body: { message: "Server Error" } },
      });

      await expect(
        resolveRepositoryUrl("https://github.com/TangleML/pipeline_components"),
      ).rejects.toThrow("Server Error");
    });
  });

  it("sends no credentials", async () => {
    await resolveRepositoryUrl(
      "https://github.com/TangleML/pipeline_components",
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).not.toHaveProperty("Authorization");
  });
});

describe("repositoryUrl", () => {
  const location = {
    owner: "TangleML",
    repo: "pipeline_components",
    ref: null,
    path: null,
  };

  it("is the repository's page when no branch or folder is set", () => {
    expect(repositoryUrl(location)).toBe(
      "https://github.com/TangleML/pipeline_components",
    );
  });

  it("names the branch and folder", () => {
    expect(
      repositoryUrl({
        ...location,
        ref: "feature/new-loader",
        path: "components/data",
      }),
    ).toBe(
      "https://github.com/TangleML/pipeline_components/tree/feature/new-loader/components/data",
    );
  });

  it("names a branch with no folder", () => {
    expect(repositoryUrl({ ...location, ref: "dev" })).toBe(
      "https://github.com/TangleML/pipeline_components/tree/dev",
    );
  });

  it("reaches a folder on the default branch through HEAD", () => {
    expect(repositoryUrl({ ...location, path: "components" })).toBe(
      "https://github.com/TangleML/pipeline_components/tree/HEAD/components",
    );
  });

  it("encodes what a URL path cannot hold", () => {
    expect(repositoryUrl({ ...location, ref: "fix#1", path: "my docs" })).toBe(
      "https://github.com/TangleML/pipeline_components/tree/fix%231/my%20docs",
    );
  });
});

describe("isGitHubWebUrl", () => {
  it("accepts only pages on github.com", () => {
    expect(isGitHubWebUrl("https://github.com/TangleML/x")).toBe(true);
    expect(isGitHubWebUrl("https://github.com.example.org/x")).toBe(false);
    expect(isGitHubWebUrl("javascript:alert(1)")).toBe(false);
  });
});

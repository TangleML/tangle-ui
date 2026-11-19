import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chooseTokenSecret,
  clearTokenSecret,
  createRepositoryGrant,
  fetchGitHubTokenStatus,
  fetchTokenSecretName,
  GitHubBackendError,
  listRepositoryGrants,
  repositoryRefExists,
  revokeRepositoryGrant,
} from "./githubBackendClient";

const BACKEND = "http://backend.test";
const fetchMock = vi.fn<typeof fetch>();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const GRANT_BODY = {
  id: 7,
  owner: "TangleML",
  repo: "secret-sauce",
  private: true,
  default_branch: "main",
  created_at: "2026-11-10T09:00:00",
};

function lastRequest() {
  const [input, init] = fetchMock.mock.calls.at(-1) ?? [];
  return { url: String(input), init };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the request to fail");
}

describe("githubBackendClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe("fetchGitHubTokenStatus", () => {
    it("reads a connected fine-grained token", async () => {
      fetchMock.mockResolvedValue(
        json(200, {
          secret_name: "GITHUB_TOKEN",
          state: "valid",
          login: "octocat",
          token_kind: "fine_grained",
        }),
      );

      await expect(fetchGitHubTokenStatus(BACKEND)).resolves.toEqual({
        supported: true,
        status: {
          secretName: "GITHUB_TOKEN",
          state: "valid",
          login: "octocat",
          tokenKind: "fine_grained",
        },
      });
      expect(lastRequest().url).toBe(`${BACKEND}/api/github/token_status`);
    });

    it("reads a token that is not configured", async () => {
      fetchMock.mockResolvedValue(
        json(200, {
          secret_name: null,
          state: "not_configured",
          login: null,
          token_kind: null,
        }),
      );

      await expect(fetchGitHubTokenStatus(BACKEND)).resolves.toEqual({
        supported: true,
        status: {
          secretName: null,
          state: "not_configured",
          login: null,
          tokenKind: null,
        },
      });
    });

    it("treats a 404 with no code as a backend without GitHub tokens", async () => {
      fetchMock.mockResolvedValue(json(404, { detail: "Not Found" }));

      await expect(fetchGitHubTokenStatus(BACKEND)).resolves.toEqual({
        supported: false,
      });
    });

    it("fails on a 404 that carries a code", async () => {
      fetchMock.mockResolvedValue(
        json(404, { detail: "No such user", code: "not_found" }),
      );

      const error = await rejection(fetchGitHubTokenStatus(BACKEND));
      expect(error).toBeInstanceOf(GitHubBackendError);
      expect(error).toMatchObject({ status: 404, code: "not_found" });
    });

    it("refuses a state it does not know", async () => {
      fetchMock.mockResolvedValue(json(200, { state: "sleeping" }));

      await expect(fetchGitHubTokenStatus(BACKEND)).rejects.toThrow(
        /can't read/,
      );
    });
  });

  describe("errors", () => {
    it("carry the status, code and detail the backend sent", async () => {
      fetchMock.mockResolvedValue(
        json(429, {
          detail: "GitHub is rate limiting this token",
          code: "github_rate_limited",
        }),
      );

      const error = await rejection(
        createRepositoryGrant(BACKEND, { owner: "TangleML", repo: "x" }),
      );

      expect(error).toBeInstanceOf(GitHubBackendError);
      expect(error).toMatchObject({
        status: 429,
        code: "github_rate_limited",
        detail: "GitHub is rate limiting this token",
        message: "GitHub is rate limiting this token",
      });
    });

    it("read a code nested under detail", async () => {
      fetchMock.mockResolvedValue(
        json(400, { detail: { detail: "No token", code: "no_token" } }),
      );

      const error = await rejection(listRepositoryGrants(BACKEND));

      expect(error).toMatchObject({
        status: 400,
        code: "no_token",
        detail: "No token",
      });
    });

    it("say what status came back when the body explains nothing", async () => {
      fetchMock.mockResolvedValue(new Response("oops", { status: 502 }));

      const error = await rejection(listRepositoryGrants(BACKEND));

      expect(error).toMatchObject({ status: 502, code: null, detail: null });
      expect(error).toHaveProperty(
        "message",
        "The backend answered with status 502.",
      );
    });

    it("report an unreachable backend as status 0", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      const error = await rejection(listRepositoryGrants(BACKEND));

      expect(error).toMatchObject({ status: 0, code: null });
    });
  });

  describe("token secret setting", () => {
    it("reads which secret is chosen", async () => {
      fetchMock.mockResolvedValue(
        json(200, { settings: { github_token_secret_name: "GITHUB_TOKEN" } }),
      );

      await expect(fetchTokenSecretName(BACKEND)).resolves.toBe("GITHUB_TOKEN");
      expect(lastRequest().url).toBe(
        `${BACKEND}/api/users/me/settings?setting_names=github_token_secret_name`,
      );
    });

    it("reads no secret when none is chosen", async () => {
      fetchMock.mockResolvedValue(json(200, { settings: {} }));

      await expect(fetchTokenSecretName(BACKEND)).resolves.toBeNull();
    });

    it("chooses a secret by name", async () => {
      fetchMock.mockResolvedValue(json(200, {}));

      await chooseTokenSecret(BACKEND, "GITHUB_TOKEN");

      const { url, init } = lastRequest();
      expect(url).toBe(`${BACKEND}/api/users/me/settings`);
      expect(init?.method).toBe("PATCH");
      expect(init?.body).toBe(
        JSON.stringify({
          settings: { github_token_secret_name: "GITHUB_TOKEN" },
        }),
      );
      expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("stops using the secret by deleting the setting", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await clearTokenSecret(BACKEND);

      const { url, init } = lastRequest();
      expect(url).toBe(
        `${BACKEND}/api/users/me/settings?setting_names=github_token_secret_name`,
      );
      expect(init?.method).toBe("DELETE");
      expect(init?.headers).toBeUndefined();
    });
  });

  describe("repository grants", () => {
    it("creates a grant for a repository", async () => {
      fetchMock.mockResolvedValue(json(201, GRANT_BODY));

      await expect(
        createRepositoryGrant(BACKEND, {
          owner: "TangleML",
          repo: "secret-sauce",
        }),
      ).resolves.toEqual({
        id: "7",
        owner: "TangleML",
        repo: "secret-sauce",
        isPrivate: true,
        defaultBranch: "main",
        createdAt: new Date("2026-11-10T09:00:00Z"),
      });

      const { url, init } = lastRequest();
      expect(url).toBe(`${BACKEND}/api/github/repository_grants`);
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({ owner: "TangleML", repo: "secret-sauce" }),
      );
      expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("lists the grants", async () => {
      fetchMock.mockResolvedValue(json(200, { grants: [GRANT_BODY] }));

      const grants = await listRepositoryGrants(BACKEND);

      expect(grants.map((grant) => grant.id)).toEqual(["7"]);
      expect(lastRequest().init?.headers).toBeUndefined();
    });

    it("revokes a grant", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await revokeRepositoryGrant(BACKEND, "7");

      const { url, init } = lastRequest();
      expect(url).toBe(`${BACKEND}/api/github/repository_grants/7`);
      expect(init?.method).toBe("DELETE");
    });

    it("asks whether a ref exists in a granted repository", async () => {
      fetchMock.mockResolvedValue(json(200, { exists: true }));

      await expect(
        repositoryRefExists(BACKEND, "7", "branch", "release/v2"),
      ).resolves.toBe(true);
      expect(lastRequest().url).toBe(
        `${BACKEND}/api/github/repository_grants/7/ref_exists?kind=branch&name=release%2Fv2`,
      );
    });
  });
});

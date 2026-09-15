import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRemoteEnvToken } from "./fetchRemoteEnvToken";

function mockFetch(response: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? 200,
    statusText: response.statusText ?? "OK",
    json: response.json ?? (async () => ({})),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchRemoteEnvToken", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns the minted token on a well-formed response", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        token: "scoped-token",
        environmentId: "env-42",
        expiresAt: 1_900_000_000_000,
      }),
    });

    const result = await fetchRemoteEnvToken({
      baseUrl: "http://tangent",
      sessionId: "s1",
    });

    expect(result).toEqual({
      token: "scoped-token",
      environmentId: "env-42",
      expiresAt: 1_900_000_000_000,
    });
  });

  it("throws on a malformed response body", async () => {
    mockFetch({ ok: true, json: async () => ({ token: "only-token" }) });

    await expect(
      fetchRemoteEnvToken({ baseUrl: "http://tangent", sessionId: "s1" }),
    ).rejects.toThrow(/malformed/i);
  });

  it("throws on a non-ok response", async () => {
    mockFetch({ ok: false, status: 401, statusText: "Unauthorized" });

    await expect(
      fetchRemoteEnvToken({ baseUrl: "http://tangent", sessionId: "s1" }),
    ).rejects.toThrow(/401/);
  });

  it("uses the dev fallback token without calling the network", async () => {
    vi.stubEnv("VITE_TANGENT_REMOTE_ENV_TOKEN", "dev-secret");
    const fetchMock = mockFetch({ ok: true });

    const result = await fetchRemoteEnvToken({
      baseUrl: "http://tangent",
      sessionId: "s1",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.token).toBe("dev-secret");
    expect(result.environmentId).toMatch(/^tangle-ui-/);
  });
});

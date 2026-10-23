import { afterEach, describe, expect, it, vi } from "vitest";

import { listTangentEnvironments } from "./listTangentEnvironments";

function mockFetch(response: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: response.ok,
    status: response.status ?? 200,
    statusText: response.statusText ?? "OK",
    json: response.json ?? (async () => ({})),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("listTangentEnvironments", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the session's environments with the bearer token", async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ environments: [] }),
    });

    await listTangentEnvironments({
      baseUrl: "http://tangent/",
      sessionId: "s1",
      authToken: "jwt",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://tangent/api/sessions/s1/environments");
    expect(init?.headers).toEqual({ Authorization: "Bearer jwt" });
  });

  it("parses environments and drops malformed entries", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        environments: [
          {
            environmentId: "s1:vscode-abc",
            owner: "me@example.com",
            scoped: true,
            toolCount: 3,
            subagentCount: 1,
          },
          { environmentId: "" },
          "not-an-environment",
        ],
      }),
    });

    const result = await listTangentEnvironments({
      baseUrl: "http://tangent",
      sessionId: "s1",
    });

    expect(result).toEqual([
      {
        environmentId: "s1:vscode-abc",
        owner: "me@example.com",
        scoped: true,
        toolCount: 3,
        subagentCount: 1,
      },
    ]);
  });

  it("keeps string metadata pairs and drops non-string values", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        environments: [
          {
            environmentId: "s1:vscode-abc",
            scoped: false,
            toolCount: 0,
            subagentCount: 0,
            metadata: {
              windowName: "my-workspace",
              workspacePath: "/home/me/proj",
              editor: "Cursor",
              portCount: 3,
            },
          },
        ],
      }),
    });

    const [environment] = await listTangentEnvironments({
      baseUrl: "http://tangent",
      sessionId: "s1",
    });

    expect(environment.metadata).toEqual({
      windowName: "my-workspace",
      workspacePath: "/home/me/proj",
      editor: "Cursor",
    });
  });

  it("omits metadata when none is advertised", async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        environments: [
          {
            environmentId: "s1:vscode-abc",
            scoped: false,
            toolCount: 0,
            subagentCount: 0,
          },
        ],
      }),
    });

    const [environment] = await listTangentEnvironments({
      baseUrl: "http://tangent",
      sessionId: "s1",
    });

    expect(environment.metadata).toBeUndefined();
  });

  it("throws on a malformed response body", async () => {
    mockFetch({ ok: true, json: async () => ({ nope: true }) });

    await expect(
      listTangentEnvironments({ baseUrl: "http://tangent", sessionId: "s1" }),
    ).rejects.toThrow(/malformed/);
  });

  it("throws on a non-ok response", async () => {
    mockFetch({ ok: false, status: 404, statusText: "Not Found" });

    await expect(
      listTangentEnvironments({ baseUrl: "http://tangent", sessionId: "s1" }),
    ).rejects.toThrow(/404/);
  });
});

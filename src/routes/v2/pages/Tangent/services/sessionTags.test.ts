import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ensureSessionTag,
  getTangentSessionTags,
  replaceTangentSessionTags,
} from "./sessionTags";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureSessionTag", () => {
  it("skips the write when the tag is already present", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ session: { tags: ["projectId:p1", "other"] } }),
      );

    const changed = await ensureSessionTag({
      baseUrl: "http://shell.test",
      sessionId: "session-a",
      authToken: "token",
      tag: "projectId:p1",
    });

    expect(changed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds the tag to the existing set when missing, preserving others", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ session: { tags: ["other"] } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const changed = await ensureSessionTag({
      baseUrl: "http://shell.test/",
      sessionId: "session-a",
      authToken: "token",
      tag: "projectId:p1",
    });

    expect(changed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://shell.test/api/sessions/session-a");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      tags: ["other", "projectId:p1"],
    });
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token");
  });

  it("treats a session with no tags as empty and writes the tag", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ session: {} }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const changed = await ensureSessionTag({
      baseUrl: "http://shell.test",
      sessionId: "session-a",
      tag: "projectId:p1",
    });

    expect(changed).toBe(true);
  });
});

describe("getTangentSessionTags", () => {
  it("reads string tags and omits the bearer header when unauthenticated", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ session: { tags: ["a", "b"] } }));

    const tags = await getTangentSessionTags({
      baseUrl: "http://shell.test",
      sessionId: "session-a",
    });

    expect(tags).toEqual(["a", "b"]);
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404, statusText: "Not Found" }),
    );

    await expect(
      getTangentSessionTags({
        baseUrl: "http://shell.test",
        sessionId: "missing",
      }),
    ).rejects.toThrow(/Failed to read Tangent session/);
  });
});

describe("replaceTangentSessionTags", () => {
  it("PATCHes the provided tags with a bearer header", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await replaceTangentSessionTags({
      baseUrl: "http://shell.test",
      sessionId: "session-a",
      authToken: "token",
      tags: ["x"],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://shell.test/api/sessions/session-a");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ tags: ["x"] });
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token");
  });

  it("throws when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: "Server Error" }),
    );

    await expect(
      replaceTangentSessionTags({
        baseUrl: "http://shell.test",
        sessionId: "session-a",
        tags: ["x"],
      }),
    ).rejects.toThrow(/Failed to update Tangent session tags/);
  });
});

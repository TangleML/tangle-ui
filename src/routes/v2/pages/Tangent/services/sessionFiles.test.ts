import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listSessionFiles,
  pinSessionFile,
  unpinSessionFile,
} from "./sessionFiles";

const BASE = "https://tangent.example/";

function respond(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(body === null ? null : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("listSessionFiles", () => {
  it("lists pinned files and the agents' other files, but not uploads or memory", async () => {
    respond({
      resources: [
        {
          kind: "artifact",
          uri: "artifacts/summary.html",
          name: "Summary",
          createdAt: "2026-11-05T00:00:00Z",
        },
        { kind: "file", uri: "artifacts/notes.md", name: "notes.md" },
        { kind: "file", uri: "uploads/data.csv", name: "data.csv" },
        { kind: "memory", uri: "memory://session", name: "Memory" },
      ],
    });

    const files = await listSessionFiles({ baseUrl: BASE, sessionId: "s-1" });

    expect(files.map(({ path, pinned }) => [path, pinned])).toEqual([
      ["artifacts/summary.html", true],
      ["artifacts/notes.md", false],
    ]);
  });
});

describe("pinning", () => {
  it("pins a file through the session's pins", async () => {
    const fetchMock = respond({ artifacts: [] });

    await pinSessionFile({
      baseUrl: BASE,
      sessionId: "s-1",
      authToken: "token",
      path: "artifacts/notes.md",
      title: "Notes",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tangent.example/api/sessions/s-1/pins",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "artifacts/notes.md", title: "Notes" }),
      }),
    );
  });

  it("unpins a file by its path", async () => {
    const fetchMock = respond(null, 204);

    await unpinSessionFile({
      baseUrl: BASE,
      sessionId: "s-1",
      path: "artifacts/a b.html",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tangent.example/api/sessions/s-1/pins?path=artifacts%2Fa%20b.html",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("says when a pin fails", async () => {
    respond({ error: "nope" }, 500);

    await expect(
      pinSessionFile({
        baseUrl: BASE,
        sessionId: "s-1",
        path: "artifacts/a.html",
        title: "A",
      }),
    ).rejects.toThrow("Couldn't pin A (500).");
  });
});

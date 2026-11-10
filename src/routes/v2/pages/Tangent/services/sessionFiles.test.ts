import type { EmbedResource } from "@tangent/embed-react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionFilesOf, setSessionFilePinned } from "./sessionFiles";
import { sessionResourcesKey } from "./sessionResources";

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

function resource(
  kind: EmbedResource["kind"],
  uri: string,
  name: string,
): EmbedResource {
  return {
    id: uri,
    sessionId: "s-1",
    kind,
    uri,
    name,
    createdAt: "2026-11-05T00:00:00Z",
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("sessionFilesOf", () => {
  it("lists pinned files and the agents' other files, but not uploads or memory", () => {
    const files = sessionFilesOf("s-1", [
      resource("artifact", "artifacts/summary.html", "Summary"),
      resource("file", "artifacts/notes.md", ""),
      resource("file", "uploads/data.csv", "data.csv"),
      resource("memory", "memory://session", "Memory"),
    ]);

    expect(
      files.map(({ path, title, pinned }) => [path, title, pinned]),
    ).toEqual([
      ["artifacts/summary.html", "Summary", true],
      ["artifacts/notes.md", "artifacts/notes.md", false],
    ]);
  });
});

describe("setSessionFilePinned", () => {
  const request = {
    baseUrl: BASE,
    sessionId: "s-1",
    authToken: "token",
    path: "artifacts/a b.html",
    title: "Notes",
  };

  it("pins a file through the session's pins and refetches the chat", async () => {
    const fetchMock = respond({ artifacts: [] });
    const client = new QueryClient();
    client.setQueryData(sessionResourcesKey("s-1"), []);

    await setSessionFilePinned(client, request, true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tangent.example/api/sessions/s-1/pins",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ path: "artifacts/a b.html", title: "Notes" }),
      }),
    );
    expect(
      client.getQueryState(sessionResourcesKey("s-1"))?.isInvalidated,
    ).toBe(true);
  });

  it("unpins a file by its path", async () => {
    const fetchMock = respond(null, 204);

    await setSessionFilePinned(new QueryClient(), request, false);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tangent.example/api/sessions/s-1/pins?path=artifacts%2Fa%20b.html",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("says when a pin fails", async () => {
    respond({ error: "nope" }, 500);

    await expect(
      setSessionFilePinned(new QueryClient(), request, true),
    ).rejects.toThrow("Couldn't pin Notes (500).");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTangentSharedFolder } from "./sharedFolders";

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTangentSharedFolder", () => {
  it("POSTs the name with a bearer header and returns the folder id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ folder: { id: "folder-1", name: "Churn" } }),
      );

    const folder = await createTangentSharedFolder({
      baseUrl: "http://shell.test/",
      authToken: "token",
      name: "Churn",
    });

    expect(folder).toEqual({ id: "folder-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://shell.test/api/shared-folders");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Churn" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer token",
    );
  });

  it("omits the name and the bearer header when neither is given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ folder: { id: "folder-1" } }));

    await createTangentSharedFolder({ baseUrl: "http://shell.test" });

    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(init?.body))).toEqual({});
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
  });

  it("throws when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: "Server Error" }),
    );

    await expect(
      createTangentSharedFolder({ baseUrl: "http://shell.test" }),
    ).rejects.toThrow(/Failed to create Tangent shared folder/);
  });

  it("rejects when the request times out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await expect(
      createTangentSharedFolder({ baseUrl: "http://shell.test" }),
    ).rejects.toThrow(/timed out/);
  });

  it("throws when the response carries no folder id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ folder: {} }),
    );

    await expect(
      createTangentSharedFolder({ baseUrl: "http://shell.test" }),
    ).rejects.toThrow(/malformed/);
  });
});

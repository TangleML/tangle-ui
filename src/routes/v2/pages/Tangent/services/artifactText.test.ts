import { afterEach, describe, expect, it, vi } from "vitest";

import {
  artifactFilename,
  fetchArtifactText,
  isTextArtifact,
} from "./artifactText";

const FILES = "https://tangent.example/api/sessions/s1/files/artifacts";

describe("isTextArtifact", () => {
  it.each(["query.sql", "train.py", "config.yaml", "notes.txt", "data.json"])(
    "treats %s as text",
    (name) => {
      expect(isTextArtifact(`${FILES}/${name}`)).toBe(true);
    },
  );

  it.each(["report.html", "readme.md", "paper.pdf", "chart.png", "model.bin"])(
    "leaves %s to the embedded viewer",
    (name) => {
      expect(isTextArtifact(`${FILES}/${name}`)).toBe(false);
    },
  );

  it("ignores the query string and is case-insensitive", () => {
    expect(isTextArtifact(`${FILES}/QUERY.SQL?v=2#top`)).toBe(true);
  });

  it("does not treat a file without an extension as text", () => {
    expect(isTextArtifact(`${FILES}/Makefile`)).toBe(false);
  });
});

describe("artifactFilename", () => {
  it("returns the decoded last path segment", () => {
    expect(artifactFilename(`${FILES}/daily%20report.sql?v=1`)).toBe(
      "daily report.sql",
    );
  });

  it("keeps a malformed escape as written", () => {
    expect(artifactFilename(`${FILES}/100%.txt`)).toBe("100%.txt");
  });
});

describe("fetchArtifactText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(response: Partial<Response>) {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      ...response,
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("reads the file with the bearer token", async () => {
    const fetchMock = mockFetch({ text: async () => "select 1;" });

    const text = await fetchArtifactText(`${FILES}/q.sql`, "jwt");

    expect(text).toBe("select 1;");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${FILES}/q.sql`);
    expect(init?.headers).toEqual({ Authorization: "Bearer jwt" });
  });

  it("sends no Authorization header without a token", async () => {
    const fetchMock = mockFetch({});

    await fetchArtifactText(`${FILES}/q.sql`);

    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({});
  });

  it("throws on a failed response", async () => {
    mockFetch({ ok: false, status: 404, statusText: "Not Found" });

    await expect(fetchArtifactText(`${FILES}/q.sql`)).rejects.toThrow(
      "Failed to load this file (404 Not Found).",
    );
  });
});

import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agentDb } from "../idb/agentDb";
import { SkillsLoader } from "./loader";

// Hoisted alongside `vi.mock` so the mock factories can close over them.
// Plain module-level consts wouldn't be initialized in time because
// `vi.mock` is hoisted to the top of the file.
const { SKILLS_BASE_URL, TEST_GIT_COMMIT, TEST_VERSION, STALE_VERSION } =
  vi.hoisted(() => {
    const gitCommit = "abc1234567";
    return {
      SKILLS_BASE_URL: "/agent-skills",
      TEST_GIT_COMMIT: gitCommit,
      TEST_VERSION: gitCommit.substring(0, 6),
      STALE_VERSION: "deadbeef",
    };
  });

vi.mock("../config", () => ({
  config: { skillsBaseUrl: SKILLS_BASE_URL },
  requireSkillsBaseUrl: () => SKILLS_BASE_URL,
}));

vi.mock("@/utils/constants", () => ({
  GIT_COMMIT: TEST_GIT_COMMIT,
}));

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/markdown" },
  });
}

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await agentDb.skills.clear();
});

describe("SkillsLoader", () => {
  it("fetches on cold cache and writes IDB row tagged with the current version", async () => {
    fetchMock.mockResolvedValue(
      textResponse("# Tangle Best Practices\nBe concise."),
    );

    const loader = new SkillsLoader();
    const result = await loader.getSkill("tangleBestPractices");

    expect(result).toContain("Be concise.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${SKILLS_BASE_URL}/tangleBestPractices/SKILL.md`,
    );

    const row = await agentDb.skills.get("tangleBestPractices");
    expect(row?.version).toBe(TEST_VERSION);
    expect(row?.content).toContain("Be concise.");
  });

  it("serves the IDB row without a network call when the version matches", async () => {
    await agentDb.skills.put({
      id: "tangleBestPractices",
      version: TEST_VERSION,
      content: "cached body",
    });

    const loader = new SkillsLoader();
    const result = await loader.getSkill("tangleBestPractices");

    expect(result).toBe("cached body");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refetches and overwrites when the IDB row's version is stale", async () => {
    await agentDb.skills.put({
      id: "tangleBestPractices",
      version: STALE_VERSION,
      content: "old body",
    });
    fetchMock.mockResolvedValue(textResponse("new body"));

    const loader = new SkillsLoader();
    const result = await loader.getSkill("tangleBestPractices");

    expect(result).toBe("new body");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const row = await agentDb.skills.get("tangleBestPractices");
    expect(row?.content).toBe("new body");
    expect(row?.version).toBe(TEST_VERSION);
  });

  it("falls back to the stale IDB row when fetch throws", async () => {
    await agentDb.skills.put({
      id: "tangleBestPractices",
      version: STALE_VERSION,
      content: "stale body",
    });
    fetchMock.mockRejectedValue(new Error("offline"));

    const loader = new SkillsLoader();
    const result = await loader.getSkill("tangleBestPractices");

    expect(result).toBe("stale body");
  });

  it("resolves with empty string when fetch fails and no IDB row exists", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { status: 404, statusText: "Not Found" }),
    );

    const loader = new SkillsLoader();
    const result = await loader.getSkill("tangleBestPractices");

    expect(result).toBe("");
  });

  it("dedupes concurrent calls for the same id into a single fetch", async () => {
    fetchMock.mockResolvedValue(textResponse("body"));

    const loader = new SkillsLoader();
    const [a, b] = await Promise.all([
      loader.getSkill("tangleBestPractices"),
      loader.getSkill("tangleBestPractices"),
    ]);

    expect(a).toBe("body");
    expect(b).toBe("body");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

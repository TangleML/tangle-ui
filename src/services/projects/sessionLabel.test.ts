import { describe, expect, it } from "vitest";

import { sessionLabelsById } from "./sessionLabel";

const at = (iso: string) => ({ createdAt: new Date(iso) });

describe("sessionLabelsById", () => {
  it("numbers the session a project started with as its first", () => {
    const labels = sessionLabelsById([
      ["newest", at("2026-09-18T10:00:00Z")],
      ["oldest", at("2026-09-16T10:00:00Z")],
      ["middle", at("2026-09-17T10:00:00Z")],
    ]);

    expect(labels.get("oldest")).toBe("Session 1");
    expect(labels.get("middle")).toBe("Session 2");
    expect(labels.get("newest")).toBe("Session 3");
  });

  /** The two lists are built from differently-ordered sources. */
  it("gives a session the same number whichever order it arrives in", () => {
    const entries: [string, { createdAt: Date }][] = [
      ["a", at("2026-09-16T10:00:00Z")],
      ["b", at("2026-09-17T10:00:00Z")],
    ];

    expect(sessionLabelsById(entries)).toEqual(
      sessionLabelsById([...entries].reverse()),
    );
  });

  it("copes with a project that has no sessions", () => {
    expect(sessionLabelsById([]).size).toBe(0);
  });
});

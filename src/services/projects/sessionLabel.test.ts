import { describe, expect, it } from "vitest";

import { sessionLabelsById } from "./sessionLabel";

const at = (iso: string): { createdAt: Date; name?: string | null } => ({
  createdAt: new Date(iso),
});

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

  it("calls a named session by its name", () => {
    const labels = sessionLabelsById([
      ["named", { ...at("2026-09-16T10:00:00Z"), name: "Fix the churn run" }],
    ]);

    expect(labels.get("named")).toBe("Fix the churn run");
  });

  /** Otherwise naming one session would renumber every session after it. */
  it("numbers the unnamed sessions by position, gaps and all", () => {
    const labels = sessionLabelsById([
      ["first", at("2026-09-16T10:00:00Z")],
      ["second", { ...at("2026-09-17T10:00:00Z"), name: "Fix the churn run" }],
      ["third", at("2026-09-18T10:00:00Z")],
    ]);

    expect(labels.get("first")).toBe("Session 1");
    expect(labels.get("second")).toBe("Fix the churn run");
    expect(labels.get("third")).toBe("Session 3");
  });

  it("numbers a session whose name was cleared", () => {
    const labels = sessionLabelsById([
      ["blank", { ...at("2026-09-16T10:00:00Z"), name: "   " }],
      ["absent", { ...at("2026-09-17T10:00:00Z"), name: null }],
    ]);

    expect(labels.get("blank")).toBe("Session 1");
    expect(labels.get("absent")).toBe("Session 2");
  });
});

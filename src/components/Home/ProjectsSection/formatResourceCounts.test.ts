import { describe, expect, it } from "vitest";

import {
  formatResourceCounts,
  totalResourceCount,
} from "./formatResourceCounts";

describe("formatResourceCounts", () => {
  it("pluralizes each entity by its own count", () => {
    expect(formatResourceCounts({ pipeline: 3, document: 1 })).toBe(
      "3 pipelines · 1 document",
    );
  });

  it("humanizes multi-word entity names", () => {
    expect(formatResourceCounts({ agent_session: 1 })).toBe("1 agent session");
    expect(formatResourceCounts({ agent_session: 2 })).toBe("2 agent sessions");
  });

  it("omits entities with a zero count", () => {
    expect(
      formatResourceCounts({ pipeline: 2, agent_session: 0, document: 0 }),
    ).toBe("2 pipelines");
  });

  it("reports an empty project when nothing is counted", () => {
    expect(formatResourceCounts({})).toBe("Empty");
    expect(formatResourceCounts({ pipeline: 0, document: 0 })).toBe("Empty");
  });

  it("orders known entities consistently regardless of key order", () => {
    expect(
      formatResourceCounts({ document: 1, pipeline: 1, agent_session: 1 }),
    ).toBe("1 pipeline · 1 agent session · 1 document");
  });

  it("appends unknown entities alphabetically after the known ones", () => {
    expect(formatResourceCounts({ widget: 1, pipeline: 1, gadget: 2 })).toBe(
      "1 pipeline · 2 gadgets · 1 widget",
    );
  });
});

describe("totalResourceCount", () => {
  it("sums every count", () => {
    expect(
      totalResourceCount({ pipeline: 3, agent_session: 1, document: 2 }),
    ).toBe(6);
  });

  it("is zero for an empty project", () => {
    expect(totalResourceCount({})).toBe(0);
    expect(totalResourceCount({ pipeline: 0 })).toBe(0);
  });
});

import { afterEach, describe, expect, it } from "vitest";

import {
  activeWorkspaces,
  pickDefaultWorkspace,
  readLastUsedWorkspaceId,
  rememberLastUsedWorkspace,
} from "./defaultWorkspace";
import type { Workspace } from "./types";

const workspace = (
  id: string,
  createdAt: string,
  overrides: Partial<Workspace> = {},
): Workspace => ({
  id,
  name: id,
  description: null,
  isActive: true,
  metadata: null,
  createdAt: new Date(createdAt),
  ...overrides,
});

const original = workspace("original", "2026-01-01T00:00:00Z", {
  name: "Research",
});
const newer = workspace("newer", "2026-06-01T00:00:00Z", { name: "Analytics" });
const retired = workspace("retired", "2025-01-01T00:00:00Z", {
  isActive: false,
});

describe("activeWorkspaces", () => {
  it("leaves out the retired ones", () => {
    expect(activeWorkspaces([original, retired, newer])).toEqual([
      original,
      newer,
    ]);
  });
});

describe("pickDefaultWorkspace", () => {
  it("picks the oldest workspace rather than the first listed", () => {
    expect(pickDefaultWorkspace([newer, original], null)).toBe(original);
  });

  it("never picks a retired workspace, however old", () => {
    expect(pickDefaultWorkspace([retired, original], null)).toBe(original);
  });

  it("prefers the workspace last used", () => {
    expect(pickDefaultWorkspace([original, newer], "newer")).toBe(newer);
  });

  it("falls back to the oldest when the one last used was retired", () => {
    expect(pickDefaultWorkspace([original, retired], "retired")).toBe(original);
  });

  it("falls back to the oldest when the one last used is gone", () => {
    expect(pickDefaultWorkspace([original, newer], "deleted")).toBe(original);
  });

  it("has nothing to offer when every workspace is retired", () => {
    expect(pickDefaultWorkspace([retired], null)).toBeUndefined();
  });
});

describe("last used workspace", () => {
  afterEach(() => localStorage.clear());

  it("is nothing before any project was created", () => {
    expect(readLastUsedWorkspaceId()).toBeNull();
  });

  it("reads back what was remembered", () => {
    rememberLastUsedWorkspace("newer");

    expect(readLastUsedWorkspaceId()).toBe("newer");
  });

  it("ignores a stored value that is not an id", () => {
    localStorage.setItem("tangle.projects.lastUsedWorkspaceId", "42");

    expect(readLastUsedWorkspaceId()).toBeNull();
  });
});

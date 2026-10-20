import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { rememberLastUsedWorkspace } from "./defaultWorkspace";
import type { Workspace } from "./types";
import { useWorkspaceChoice } from "./useWorkspaceChoice";

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

const research = workspace("research", "2026-01-01T00:00:00Z");
const analytics = workspace("analytics", "2026-06-01T00:00:00Z");
const legacy = workspace("legacy", "2025-01-01T00:00:00Z", {
  isActive: false,
});

const choiceAmong = (workspaces: Workspace[] | undefined) =>
  renderHook(() => useWorkspaceChoice(workspaces)).result;

describe("useWorkspaceChoice", () => {
  afterEach(() => localStorage.clear());

  it("offers only the workspaces still taking new projects", () => {
    const choice = choiceAmong([analytics, legacy, research]);

    expect(choice.current.workspaces).toEqual([analytics, research]);
  });

  it("offers a choice only when more than one workspace takes projects", () => {
    expect(choiceAmong([analytics, research]).current.offersChoice).toBe(true);
    expect(choiceAmong([legacy, research]).current.offersChoice).toBe(false);
    expect(choiceAmong([]).current.offersChoice).toBe(false);
  });

  it("starts on the default workspace", () => {
    expect(choiceAmong([analytics, research]).current.selected).toBe(research);
  });

  it("starts on the workspace last used", () => {
    rememberLastUsedWorkspace("analytics");

    expect(choiceAmong([analytics, research]).current.selected).toBe(analytics);
  });

  it("offers nothing to select when no workspace takes new projects", () => {
    const choice = choiceAmong([legacy]);

    expect(choice.current.workspaces).toEqual([]);
    expect(choice.current.selected).toBeUndefined();
  });

  it("selects what was chosen and says it is not the default", () => {
    const choice = choiceAmong([analytics, research]);

    act(() => choice.current.choose("analytics"));

    expect(choice.current.selected).toBe(analytics);
    expect(choice.current.changedFromDefault).toBe(true);
  });

  it("goes back to the default once reset", () => {
    const choice = choiceAmong([analytics, research]);
    act(() => choice.current.choose("analytics"));

    act(() => choice.current.reset());

    expect(choice.current.selected).toBe(research);
    expect(choice.current.changedFromDefault).toBe(false);
  });

  it("never selects a retired workspace, even when chosen", () => {
    const choice = choiceAmong([legacy, research]);

    act(() => choice.current.choose("legacy"));

    expect(choice.current.selected).toBe(research);
  });
});

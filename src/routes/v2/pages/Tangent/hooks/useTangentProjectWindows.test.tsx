import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";
import type { TeamResolution } from "@/services/teams/types";
import { useTeamForProjects } from "@/services/teams/useTeamForProjects";

import { PROJECT_DOCK_WINDOW_IDS } from "./tangentProjectWindowOrder";
import { useTangentProjectWindows } from "./useTangentProjectWindows";

const stores = vi.hoisted(() => ({
  windows: undefined as WindowStoreImpl | undefined,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: stores.windows }),
}));

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

vi.mock("@/services/teams/useTeamForProjects", () => ({
  useTeamForProjects: vi.fn(),
}));

const SECRETS_WINDOW_ID = "tangent-project-secrets";
const TEAM = { id: "ml-team@example.com", label: "ML Research" };
const ACTIVE_TEAM: TeamResolution = {
  status: "active",
  team: { ...TEAM, canWrite: true },
};

function dockedStore() {
  const windows = new WindowStoreImpl();
  windows.enableDockSide("left");
  return windows;
}

function mountWindows(resolution: TeamResolution, windows = dockedStore()) {
  stores.windows = windows;
  vi.mocked(useTeamForProjects).mockReturnValue(resolution);
  const { rerender } = renderHook(() => useTangentProjectWindows());

  return {
    windows,
    resolveTo: (next: TeamResolution) => {
      vi.mocked(useTeamForProjects).mockReturnValue(next);
      rerender();
    },
  };
}

describe("useTangentProjectWindows", () => {
  afterEach(() => vi.clearAllMocks());

  it("asks for the team of the Tangent project", () => {
    mountWindows({ status: "none" });

    expect(useTeamForProjects).toHaveBeenCalledWith(["project-1"]);
  });

  it("docks the Secrets window last in a project whose workspace has a team", () => {
    const { windows } = mountWindows(ACTIVE_TEAM);

    expect(windows.getDockedWindowOrder("left")).toEqual(
      PROJECT_DOCK_WINDOW_IDS,
    );
  });

  it("has no Secrets window in a project whose workspace has no team", () => {
    const { windows } = mountWindows({ status: "none" });

    expect(windows.getWindowById(SECRETS_WINDOW_ID)).toBeUndefined();
    expect(windows.getDockedWindowOrder("left")).toEqual(
      PROJECT_DOCK_WINDOW_IDS.filter((id) => id !== SECRETS_WINDOW_ID),
    );
  });

  it.each<TeamResolution>([
    { status: "not-member", team: TEAM },
    { status: "unavailable", team: TEAM },
    { status: "error", error: new Error("backend down") },
  ])(
    "keeps the Secrets window when you can't act as the workspace's team ($status)",
    (resolution) => {
      const { windows } = mountWindows(resolution);

      expect(windows.getWindowById(SECRETS_WINDOW_ID)).toBeDefined();
    },
  );

  it("opens the Secrets window once the workspace's team is known", () => {
    const { windows, resolveTo } = mountWindows({ status: "resolving" });

    expect(windows.getWindowById(SECRETS_WINDOW_ID)).toBeUndefined();

    resolveTo(ACTIVE_TEAM);

    expect(windows.getWindowById(SECRETS_WINDOW_ID)).toBeDefined();
  });

  it("closes the Secrets window when the project has no team", () => {
    const { windows, resolveTo } = mountWindows(ACTIVE_TEAM);

    resolveTo({ status: "none" });

    expect(windows.getWindowById(SECRETS_WINDOW_ID)).toBeUndefined();
  });

  it("puts a late Secrets window where the saved layout had it", () => {
    const saved = [
      "tangent-project-details",
      SECRETS_WINDOW_ID,
      "tangent-project-sessions",
      "tangent-project-agents",
      "tangent-project-assets",
      "tangent-project-resources",
      "tangent-project-runs",
    ];
    const windows = dockedStore();
    windows.restoreDockArea("left", {
      width: 320,
      collapsed: false,
      windowOrder: saved,
    });

    const { resolveTo } = mountWindows({ status: "resolving" }, windows);
    resolveTo(ACTIVE_TEAM);

    expect(windows.getDockedWindowOrder("left")).toEqual(saved);
  });
});

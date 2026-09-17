import { describe, expect, it, vi } from "vitest";

import type { WorkareaTab } from "@/routes/v2/pages/Tangent/workarea/types";
import {
  idIdentity,
  nameIdentity,
} from "@/routes/v2/pages/Tangent/workarea/workareaTarget";

import {
  createWorkareaRemoteTools,
  type WorkareaToolDeps,
} from "./createWorkareaRemoteTools";

function artifactTab(id: string, url: string): WorkareaTab {
  return {
    id,
    title: `Artifact ${id}`,
    target: { type: "artifact", identity: idIdentity(url) },
  };
}

function pipelineTab(id: string, fileId?: string): WorkareaTab {
  return {
    id,
    title: "Pipeline",
    target: {
      type: "pipeline",
      identity: fileId ? idIdentity(fileId) : nameIdentity("Draft"),
    },
  };
}

function runTab(id: string, runId: string): WorkareaTab {
  return {
    id,
    title: `Run ${runId}`,
    target: { type: "run", identity: idIdentity(runId) },
  };
}

function makeDeps(overrides: Partial<WorkareaToolDeps> = {}): WorkareaToolDeps {
  return {
    openTarget: vi.fn(),
    getTabs: () => [],
    getActiveTabId: () => undefined,
    closeTab: vi.fn(),
    ...overrides,
  };
}

describe("createWorkareaRemoteTools", () => {
  it("open_workarea_target parses the target, opens it, and returns the active summary", async () => {
    const tab = pipelineTab("tab-pipe", "file-1");
    const openTarget = vi.fn().mockResolvedValue(tab);
    const tools = createWorkareaRemoteTools(() => makeDeps({ openTarget }));

    const result = await tools.open_workarea_target.execute({
      target: "pipeline://id/file-1",
      title: "My pipeline",
    });

    expect(openTarget).toHaveBeenCalledWith(
      { type: "pipeline", identity: "id/file-1" },
      "My pipeline",
    );
    expect(result).toEqual({
      id: "tab-pipe",
      kind: "pipeline",
      title: "Pipeline",
      target: "pipeline://id/file-1",
      active: true,
    });
  });

  it("open_workarea_target requires a string target", async () => {
    const tools = createWorkareaRemoteTools(() => makeDeps());
    await expect(tools.open_workarea_target.execute({})).rejects.toThrow(
      /target/,
    );
  });

  it("list_workarea_tabs summarizes every tab with its active flag and target", () => {
    const deps = makeDeps({
      getTabs: () => [
        artifactTab("tab-art", "https://example.com/report"),
        pipelineTab("tab-pipe"),
        runTab("tab-run", "run-1"),
      ],
      getActiveTabId: () => "tab-pipe",
    });
    const tools = createWorkareaRemoteTools(() => deps);

    const result = tools.list_workarea_tabs.execute({});

    expect(result).toEqual([
      {
        id: "tab-art",
        kind: "artifact",
        title: "Artifact tab-art",
        target: "artifact://id/https://example.com/report",
        active: false,
      },
      {
        id: "tab-pipe",
        kind: "pipeline",
        title: "Pipeline",
        target: "pipeline://name/Draft",
        active: true,
      },
      {
        id: "tab-run",
        kind: "run",
        title: "Run run-1",
        target: "run://id/run-1",
        active: false,
      },
    ]);
  });

  it("get_active_workarea_tab returns the active tab, or null when none is open", () => {
    const withActive = createWorkareaRemoteTools(() =>
      makeDeps({
        getTabs: () => [pipelineTab("tab-pipe", "file-9")],
        getActiveTabId: () => "tab-pipe",
      }),
    );
    expect(withActive.get_active_workarea_tab.execute({})).toEqual({
      id: "tab-pipe",
      kind: "pipeline",
      title: "Pipeline",
      target: "pipeline://id/file-9",
      active: true,
    });

    const empty = createWorkareaRemoteTools(() => makeDeps());
    expect(empty.get_active_workarea_tab.execute({})).toBeNull();
  });

  it("close_workarea_tab closes by id and requires a string tabId", () => {
    const closeTab = vi.fn();
    const tools = createWorkareaRemoteTools(() => makeDeps({ closeTab }));

    expect(tools.close_workarea_tab.execute({ tabId: "tab-1" })).toEqual({
      ok: true,
    });
    expect(closeTab).toHaveBeenCalledWith("tab-1");

    expect(() => tools.close_workarea_tab.execute({})).toThrow(/tabId/);
  });
});

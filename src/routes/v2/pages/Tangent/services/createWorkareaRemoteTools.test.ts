import { describe, expect, it, vi } from "vitest";

import type { WorkareaTab } from "@/routes/v2/pages/Tangent/workarea/types";
import {
  idIdentity,
  nameIdentity,
} from "@/routes/v2/pages/Tangent/workarea/workareaTarget";
import { getOverallExecutionStatusFromStats } from "@/utils/executionStatus";

import {
  createWorkareaRemoteTools,
  type RunInspectDeps,
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

function makeRunInspect(
  overrides: Partial<RunInspectDeps> = {},
): RunInspectDeps {
  return {
    getRunDetails: vi.fn(),
    debugPipelineRun: vi.fn(),
    getExecutionDetails: vi.fn(),
    getExecutionState: vi.fn(),
    getContainerState: vi.fn(),
    getContainerLog: vi.fn(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<WorkareaToolDeps> = {}): WorkareaToolDeps {
  return {
    openTarget: vi.fn(),
    getTabs: () => [],
    getActiveTabId: () => undefined,
    closeTab: vi.fn(),
    getEnvironmentId: () => undefined,
    waitForEnvironment: vi.fn().mockResolvedValue(undefined),
    runInspect: makeRunInspect(),
    ...overrides,
  };
}

function defer<T>() {
  let resolver: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return {
    promise,
    resolve(value: T) {
      if (!resolver) throw new Error("Deferred resolver was not initialized");
      resolver(value);
    },
  };
}

describe("createWorkareaRemoteTools", () => {
  it("open_workarea_target opens a pipeline, waits for its environment, and returns the ready summary", async () => {
    const tab = pipelineTab("tab-pipe", "file-1");
    const openTarget = vi.fn().mockResolvedValue(tab);
    const waitForEnvironment = vi.fn().mockResolvedValue("env-tab-pipe");
    const tools = createWorkareaRemoteTools(() =>
      makeDeps({
        openTarget,
        waitForEnvironment,
        getTabs: () => [tab],
        getActiveTabId: () => tab.id,
      }),
    );

    const result = await tools.open_workarea_target.execute({
      target: "pipeline://id/file-1",
      title: "My pipeline",
    });

    expect(openTarget).toHaveBeenCalledWith(
      { type: "pipeline", identity: "id/file-1" },
      "My pipeline",
    );
    expect(waitForEnvironment).toHaveBeenCalledWith("tab-pipe");
    expect(result).toEqual({
      id: "tab-pipe",
      kind: "pipeline",
      title: "Pipeline",
      target: "pipeline://id/file-1",
      active: true,
      environmentId: "env-tab-pipe",
      ready: true,
    });
  });

  it("open_workarea_target does not wait on an environment for a non-spawnable artifact tab", async () => {
    const tab = artifactTab("tab-art", "https://example.com/report");
    const openTarget = vi.fn().mockResolvedValue(tab);
    const waitForEnvironment = vi.fn().mockResolvedValue(undefined);
    const tools = createWorkareaRemoteTools(() =>
      makeDeps({
        openTarget,
        waitForEnvironment,
        getTabs: () => [tab],
        getActiveTabId: () => tab.id,
      }),
    );

    const result = await tools.open_workarea_target.execute({
      target: "artifact://id/https://example.com/report",
    });

    expect(waitForEnvironment).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "tab-art",
      kind: "artifact",
      title: "Artifact tab-art",
      target: "artifact://id/https://example.com/report",
      active: true,
    });
  });

  it("open_workarea_target reports a spawnable tab as not ready when the environment never connects", async () => {
    const tab = pipelineTab("tab-pipe", "file-1");
    const openTarget = vi.fn().mockResolvedValue(tab);
    const waitForEnvironment = vi.fn().mockResolvedValue(undefined);
    const tools = createWorkareaRemoteTools(() =>
      makeDeps({
        openTarget,
        waitForEnvironment,
        getTabs: () => [tab],
        getActiveTabId: () => tab.id,
      }),
    );

    const result = await tools.open_workarea_target.execute({
      target: "pipeline://id/file-1",
    });

    expect(result).toMatchObject({ ready: false });
    expect(result).not.toHaveProperty("environmentId", expect.anything());
  });

  it("re-reads active tab state after waiting for an environment", async () => {
    const tab = pipelineTab("tab-pipe", "file-1");
    const otherTab = artifactTab("tab-art", "https://example.com");
    const environment = defer<string | undefined>();
    let activeTabId = tab.id;
    const tools = createWorkareaRemoteTools(() =>
      makeDeps({
        openTarget: vi.fn().mockResolvedValue(tab),
        waitForEnvironment: vi.fn(() => environment.promise),
        getTabs: () => [tab, otherTab],
        getActiveTabId: () => activeTabId,
      }),
    );

    const resultPromise = tools.open_workarea_target.execute({
      target: "pipeline://id/file-1",
    });
    activeTabId = otherTab.id;
    environment.resolve("env-1");

    await expect(resultPromise).resolves.toMatchObject({ active: false });
  });

  it("rejects when the opened tab closes while waiting for an environment", async () => {
    const tab = pipelineTab("tab-pipe", "file-1");
    const environment = defer<string | undefined>();
    let tabs: WorkareaTab[] = [tab];
    const tools = createWorkareaRemoteTools(() =>
      makeDeps({
        openTarget: vi.fn().mockResolvedValue(tab),
        waitForEnvironment: vi.fn(() => environment.promise),
        getTabs: () => tabs,
        getActiveTabId: () => tab.id,
      }),
    );

    const resultPromise = tools.open_workarea_target.execute({
      target: "pipeline://id/file-1",
    });
    tabs = [];
    environment.resolve(undefined);

    await expect(resultPromise).rejects.toThrow(/was closed/);
  });

  it("open_workarea_target requires a string target", async () => {
    const tools = createWorkareaRemoteTools(() => makeDeps());
    await expect(tools.open_workarea_target.execute({})).rejects.toThrow(
      /target/,
    );
  });

  it("list_workarea_tabs adds environmentId/ready to spawnable tabs and leaves artifacts bare", () => {
    const deps = makeDeps({
      getTabs: () => [
        artifactTab("tab-art", "https://example.com/report"),
        pipelineTab("tab-pipe"),
        runTab("tab-run", "run-1"),
      ],
      getActiveTabId: () => "tab-pipe",
      getEnvironmentId: (tabId) =>
        tabId === "tab-pipe" ? "env-pipe" : undefined,
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
        environmentId: "env-pipe",
        ready: true,
      },
      {
        id: "tab-run",
        kind: "run",
        title: "Run run-1",
        target: "run://id/run-1",
        active: false,
        ready: false,
      },
    ]);
  });

  it("get_active_workarea_tab returns the active spawnable tab with env fields, or null when none is open", () => {
    const withActive = createWorkareaRemoteTools(() =>
      makeDeps({
        getTabs: () => [pipelineTab("tab-pipe", "file-9")],
        getActiveTabId: () => "tab-pipe",
        getEnvironmentId: () => "env-9",
      }),
    );
    expect(withActive.get_active_workarea_tab.execute({})).toEqual({
      id: "tab-pipe",
      kind: "pipeline",
      title: "Pipeline",
      target: "pipeline://id/file-9",
      active: true,
      environmentId: "env-9",
      ready: true,
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

  describe("run inspect tools", () => {
    it("get_run_status resolves the run from the active run tab and derives the overall status", async () => {
      const run = { id: 1, execution_status_stats: { SUCCEEDED: 2 } };
      const getRunDetails = vi.fn().mockResolvedValue(run);
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({
          getTabs: () => [runTab("tab-run", "run-77")],
          getActiveTabId: () => "tab-run",
          runInspect: makeRunInspect({ getRunDetails }),
        }),
      );

      const result = await tools.get_run_status.execute({});

      expect(getRunDetails).toHaveBeenCalledWith("run-77");
      expect(result).toEqual({
        run,
        status: getOverallExecutionStatusFromStats(run.execution_status_stats),
      });
    });

    it("get_run_status prefers an explicit runId over the open tabs", async () => {
      const getRunDetails = vi.fn().mockResolvedValue({});
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({
          getTabs: () => [runTab("tab-run", "run-open")],
          getActiveTabId: () => "tab-run",
          runInspect: makeRunInspect({ getRunDetails }),
        }),
      );

      await tools.get_run_status.execute({ runId: "run-explicit" });

      expect(getRunDetails).toHaveBeenCalledWith("run-explicit");
    });

    it("rejects a malformed explicit runId instead of falling back", async () => {
      const getRunDetails = vi.fn();
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({
          getTabs: () => [runTab("tab-run", "run-open")],
          getActiveTabId: () => "tab-run",
          runInspect: makeRunInspect({ getRunDetails }),
        }),
      );

      await expect(
        tools.get_run_status.execute({ runId: 123 }),
      ).rejects.toThrow(/non-empty string/);
      await expect(tools.get_run_status.execute({ runId: "" })).rejects.toThrow(
        /non-empty string/,
      );
      expect(getRunDetails).not.toHaveBeenCalled();
    });

    it("debug_pipeline_run resolves the only open run tab when none is active", async () => {
      const debugPipelineRun = vi.fn().mockResolvedValue({ ok: true });
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({
          getTabs: () => [runTab("tab-run", "run-solo")],
          getActiveTabId: () => undefined,
          runInspect: makeRunInspect({ debugPipelineRun }),
        }),
      );

      await tools.debug_pipeline_run.execute({});

      expect(debugPipelineRun).toHaveBeenCalledWith("run-solo");
    });

    it("run inspect throws a helpful error when no run is open", async () => {
      const tools = createWorkareaRemoteTools(() => makeDeps());
      await expect(tools.get_run_status.execute({})).rejects.toThrow(/run/i);
    });

    it("run inspect throws when multiple runs are open and none is active", async () => {
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({
          getTabs: () => [runTab("tab-a", "run-a"), runTab("tab-b", "run-b")],
          getActiveTabId: () => undefined,
        }),
      );
      await expect(tools.debug_pipeline_run.execute({})).rejects.toThrow(
        /Multiple runs/,
      );
    });

    it("get_execution_details requires an executionId and forwards it", async () => {
      const getExecutionDetails = vi.fn().mockResolvedValue({
        id: "exec-1",
        task_spec: {},
        child_task_execution_ids: {},
        input_artifact_ids: {},
        output_artifact_ids: {},
      });
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({ runInspect: makeRunInspect({ getExecutionDetails }) }),
      );

      await tools.get_execution_details.execute({ executionId: "exec-1" });
      expect(getExecutionDetails).toHaveBeenCalledWith("exec-1");

      await expect(tools.get_execution_details.execute({})).rejects.toThrow(
        /executionId/,
      );
      await expect(
        tools.get_execution_details.execute({ executionId: "" }),
      ).rejects.toThrow(/non-empty string/);
    });

    it("get_container_log forwards the executionId to the inspect bridge", async () => {
      const getContainerLog = vi.fn().mockResolvedValue({
        log: "done",
        error_message: null,
        orchestration_error: null,
        truncated: false,
      });
      const tools = createWorkareaRemoteTools(() =>
        makeDeps({ runInspect: makeRunInspect({ getContainerLog }) }),
      );

      await tools.get_container_log.execute({ executionId: "exec-9" });
      expect(getContainerLog).toHaveBeenCalledWith("exec-9");
    });
  });
});

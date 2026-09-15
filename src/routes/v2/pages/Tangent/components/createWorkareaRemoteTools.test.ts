import { describe, expect, it, vi } from "vitest";

import type { WorkareaTab } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

import {
  createWorkareaRemoteTools,
  type RunInspectDeps,
  type WorkareaToolDeps,
} from "./createWorkareaRemoteTools";

function runTab(id: string, runId: string): WorkareaTab {
  return { id, kind: "run", title: `Run ${runId}`, runId };
}

function pipelineTab(id: string): WorkareaTab {
  return { id, kind: "pipeline", title: "Pipeline", pipelineRef: { name: id } };
}

function makeRunInspect(
  overrides: Partial<RunInspectDeps> = {},
): RunInspectDeps {
  const stub = vi.fn();
  return new Proxy({} as RunInspectDeps, {
    get(_target, prop: string) {
      if (prop in overrides) {
        return (overrides as Record<string, unknown>)[prop];
      }
      return stub;
    },
  });
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

describe("createWorkareaRemoteTools", () => {
  it("open_pipeline waits for and returns the environment id for run tabs", async () => {
    const tab = runTab("tab-run", "42");
    const deps = makeDeps({
      openTarget: vi.fn().mockResolvedValue(tab),
      waitForEnvironment: vi.fn().mockResolvedValue("env-run"),
    });
    const tools = createWorkareaRemoteTools(() => deps);

    const result = await tools.open_pipeline.execute({ target: "run:42" });

    expect(deps.waitForEnvironment).toHaveBeenCalledWith("tab-run");
    expect(result).toEqual({
      id: "tab-run",
      kind: "run",
      title: "Run 42",
      environmentId: "env-run",
      ready: true,
    });
  });

  it("get_run_status defaults the runId to the only open run tab", async () => {
    const getRunDetails = vi.fn().mockResolvedValue({
      id: "42",
      root_execution_id: "r-42",
      execution_status_stats: { SUCCEEDED: 2, FAILED: 1 },
    });
    const deps = makeDeps({
      getTabs: () => [pipelineTab("tab-pipe"), runTab("tab-run", "42")],
      runInspect: makeRunInspect({ getRunDetails }),
    });
    const tools = createWorkareaRemoteTools(() => deps);

    const result = (await tools.get_run_status.execute({})) as {
      run: { id: string };
      status: string;
    };

    expect(getRunDetails).toHaveBeenCalledWith("42");
    expect(result.run.id).toBe("42");
    expect(result.status).toBe("FAILED");
  });

  it("get_run_status prefers the active run tab over other open runs", async () => {
    const getRunDetails = vi.fn().mockResolvedValue({
      id: "99",
      execution_status_stats: {},
    });
    const deps = makeDeps({
      getTabs: () => [runTab("tab-a", "42"), runTab("tab-b", "99")],
      getActiveTabId: () => "tab-b",
      runInspect: makeRunInspect({ getRunDetails }),
    });
    const tools = createWorkareaRemoteTools(() => deps);

    await tools.get_run_status.execute({});

    expect(getRunDetails).toHaveBeenCalledWith("99");
  });

  it("debug_pipeline_run throws a clear error when no run is open", async () => {
    const deps = makeDeps({ getTabs: () => [pipelineTab("tab-pipe")] });
    const tools = createWorkareaRemoteTools(() => deps);

    await expect(tools.debug_pipeline_run.execute({})).rejects.toThrow(
      /No run is open/,
    );
  });

  it("get_container_state truncates oversized debug_info before returning", async () => {
    const debug_info: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) debug_info[`k${i}`] = `v${i}`;
    const getContainerState = vi
      .fn()
      .mockResolvedValue({ status: "FAILED", debug_info });
    const deps = makeDeps({
      runInspect: makeRunInspect({ getContainerState }),
    });
    const tools = createWorkareaRemoteTools(() => deps);

    const result = (await tools.get_container_state.execute({
      executionId: "exec-1",
    })) as { debug_info: Record<string, unknown> };

    expect(Object.keys(result.debug_info).length).toBeLessThanOrEqual(20);
  });

  it("get_execution_details requires an executionId", async () => {
    const tools = createWorkareaRemoteTools(() => makeDeps());
    await expect(tools.get_execution_details.execute({})).rejects.toThrow(
      /executionId/,
    );
  });
});

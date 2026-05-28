import { RunContext } from "@openai/agents-core";
import { describe, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "../toolBridgeApi";
import { createDebugTools } from "./debugTools";

type FunctionTool = ReturnType<typeof createDebugTools>["allTools"][number];

function makeBridge(overrides: Partial<ToolBridgeApi> = {}): ToolBridgeApi {
  const stub = vi.fn();
  return new Proxy({} as ToolBridgeApi, {
    get(_target, prop: string) {
      if (prop in overrides) {
        return (overrides as Record<string, unknown>)[prop];
      }
      return stub;
    },
  });
}

async function invoke(tool: FunctionTool, payload: unknown): Promise<unknown> {
  const ctx = new RunContext();
  const raw = await tool.invoke(ctx, JSON.stringify(payload));
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

/**
 * The truncation logic itself is tested in `src/agent/util/truncate.test.ts`.
 * These tests only verify that each debug tool wires its corresponding
 * `truncate*` helper into the bridge response — i.e. truncation is
 * actually applied at the boundary, not silently bypassed.
 */
describe("createDebugTools", () => {
  it("exposes the four read-only tool names", () => {
    const { allTools } = createDebugTools(makeBridge());
    expect(allTools.map((t) => t.name).sort()).toEqual([
      "get_container_log",
      "get_container_state",
      "get_execution_details",
      "get_execution_state",
    ]);
  });

  it("get_execution_details applies artifact-map truncation to the bridge result", async () => {
    const getExecutionDetails = vi.fn().mockResolvedValue({
      id: "exec-1",
      task_spec: {},
      child_task_execution_ids: {},
      input_artifacts: { in: { id: "art1" } },
      output_artifacts: { out: { id: "art2" } },
    });
    const { getExecutionDetails: tool } = createDebugTools(
      makeBridge({ getExecutionDetails }),
    );

    const result = (await invoke(tool, { executionId: "exec-1" })) as {
      input_artifacts: Record<string, unknown>;
      output_artifacts: Record<string, unknown>;
    };
    expect(result.input_artifacts).toEqual({});
    expect(result.output_artifacts).toEqual({});
  });

  it("get_container_state applies debug_info truncation to the bridge result", async () => {
    const debug_info: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) debug_info[`k${i}`] = `v${i}`;
    const getContainerState = vi
      .fn()
      .mockResolvedValue({ status: "FAILED", debug_info });
    const { getContainerState: tool } = createDebugTools(
      makeBridge({ getContainerState }),
    );

    const result = (await invoke(tool, { executionId: "exec-1" })) as {
      debug_info: Record<string, unknown>;
    };
    expect(Object.keys(result.debug_info).length).toBeLessThanOrEqual(20);
  });

  it("get_container_log applies log truncation to the bridge result", async () => {
    const longLog = "L".repeat(20_000);
    const getContainerLog = vi.fn().mockResolvedValue({ log_text: longLog });
    const { getContainerLog: tool } = createDebugTools(
      makeBridge({ getContainerLog }),
    );

    const result = (await invoke(tool, { executionId: "exec-1" })) as {
      log_text: string;
      truncated?: boolean;
    };
    expect(result.truncated).toBe(true);
    expect(result.log_text.length).toBeLessThan(longLog.length);
  });
});

import { RunContext } from "@openai/agents-core";
import { describe, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "../toolBridgeApi";
import { createRunTools } from "./runTools";

type FunctionTool = ReturnType<typeof createRunTools>["allTools"][number];

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

describe("createRunTools", () => {
  it("exposes allTools containing every tool by name", () => {
    const { allTools } = createRunTools(makeBridge());
    const names = allTools.map((t) => t.name);
    expect(names).toEqual([
      "submit_pipeline_run",
      "get_run_status",
      "debug_pipeline_run",
    ]);
  });

  it("get_run_status derives overall status from execution_status_stats", async () => {
    const getRunDetails = vi.fn().mockResolvedValue({
      id: "1",
      root_execution_id: "r-1",
      execution_status_stats: { SUCCEEDED: 2, FAILED: 1 },
    });
    const bridge = makeBridge({ getRunDetails });
    const { getRunStatus } = createRunTools(bridge);

    const result = (await invoke(getRunStatus, { runId: "1" })) as {
      run: { id: string };
      status: string;
    };
    expect(result.status).toBe("FAILED");
    expect(result.run.id).toBe("1");
  });
});

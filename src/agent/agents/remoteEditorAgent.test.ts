import { describe, expect, it, vi } from "vitest";

import type { AgentSession } from "../session";
import type { ToolBridgeApi } from "../toolBridgeApi";
import type { AgentContext } from "../types";
import { selectRemoteEditorTools } from "./remoteEditorAgent";

function makeBridge(): ToolBridgeApi {
  const stub = vi.fn();
  return new Proxy({} as ToolBridgeApi, {
    get: () => stub,
  });
}

function makeSession(context: AgentContext = { mode: "editor" }): AgentSession {
  return { bridge: makeBridge(), context } as unknown as AgentSession;
}

function toolNames(session: AgentSession, allowlist: string[]): string[] {
  return selectRemoteEditorTools(session, allowlist)
    .map((toolDef) => toolDef.name)
    .sort();
}

describe("selectRemoteEditorTools", () => {
  it("grants the full CSOM + search + run + debug registry in editor mode for an empty allowlist", () => {
    const names = toolNames(makeSession(), []);
    // 18 CSOM tools + search_components + 3 run tools + 4 debug tools.
    expect(names).toHaveLength(26);
    expect(names).toContain("search_components");
    expect(names).toContain("submit_pipeline_run");
    expect(names).toContain("get_pipeline_state");
    expect(names).toContain("validate_pipeline");
    expect(names).toContain("debug_pipeline_run");
    expect(names).toContain("get_container_log");
  });

  it("grants the read-only inspect registry in runView mode for an empty allowlist", () => {
    const names = toolNames(makeSession({ mode: "runView", runId: "42" }), []);
    expect(names).toEqual([
      "debug_pipeline_run",
      "get_container_log",
      "get_container_state",
      "get_execution_details",
      "get_execution_state",
      "get_pipeline_state",
      "get_run_status",
      "validate_pipeline",
    ]);
    // No mutating CSOM, no component search, no run submission.
    expect(names).not.toContain("add_task");
    expect(names).not.toContain("search_components");
    expect(names).not.toContain("submit_pipeline_run");
  });

  it("grants only the allowlisted subset", () => {
    const names = toolNames(makeSession(), ["add_task", "search_components"]);
    expect(names).toEqual(["add_task", "search_components"]);
  });

  it("ignores unknown tool names", () => {
    const names = toolNames(makeSession(), ["add_task", "does_not_exist"]);
    expect(names).toEqual(["add_task"]);
  });
});

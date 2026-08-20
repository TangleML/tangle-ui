import { describe, expect, it, vi } from "vitest";

import type { AgentSession } from "../session";
import type { ToolBridgeApi } from "../toolBridgeApi";
import { selectRemoteEditorTools } from "./remoteEditorAgent";

function makeBridge(): ToolBridgeApi {
  const stub = vi.fn();
  return new Proxy({} as ToolBridgeApi, {
    get: () => stub,
  });
}

function makeSession(): AgentSession {
  return { bridge: makeBridge() } as unknown as AgentSession;
}

function toolNames(session: AgentSession, allowlist: string[]): string[] {
  return selectRemoteEditorTools(session, allowlist)
    .map((toolDef) => toolDef.name)
    .sort();
}

describe("selectRemoteEditorTools", () => {
  it("grants the full CSOM + search + run registry for an empty allowlist", () => {
    const names = toolNames(makeSession(), []);
    // 18 CSOM tools + search_components + 3 run tools.
    expect(names).toHaveLength(22);
    expect(names).toContain("search_components");
    expect(names).toContain("submit_pipeline_run");
    expect(names).toContain("get_pipeline_state");
    expect(names).toContain("validate_pipeline");
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

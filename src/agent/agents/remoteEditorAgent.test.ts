import { describe, expect, it, vi } from "vitest";

import type { AgentSession } from "../session";
import type { ToolBridgeApi } from "../toolBridgeApi";
import type { AgentContext } from "../types";
import {
  buildRemoteEditorAgent,
  describeToolGrant,
  selectRemoteEditorTools,
} from "./remoteEditorAgent";

function makeBridge(): ToolBridgeApi {
  const stub = vi.fn();
  return new Proxy({} as ToolBridgeApi, {
    get: () => stub,
  });
}

function makeSession(context: AgentContext = { mode: "editor" }): AgentSession {
  return {
    bridge: makeBridge(),
    context,
    aiConfig: {
      apiBase: "https://proxy.example/v1",
      apiKey: "",
      model: "gpt",
    },
    emitStatus: vi.fn(),
  } as unknown as AgentSession;
}

function toolNames(session: AgentSession, allowlist: string[]): string[] {
  return selectRemoteEditorTools(session, allowlist)
    .map((toolDef) => toolDef.name)
    .sort();
}

describe("selectRemoteEditorTools", () => {
  it("grants no tools for an empty resolved allowlist", () => {
    expect(toolNames(makeSession(), [])).toEqual([]);
  });

  it("limits a run-view allowlist to its read-only registry", () => {
    const names = toolNames(makeSession({ mode: "runView", runId: "42" }), [
      "add_task",
      "debug_pipeline_run",
      "get_run_status",
      "submit_pipeline_run",
    ]);
    expect(names).toEqual(["debug_pipeline_run", "get_run_status"]);
  });

  it("grants only the allowlisted subset", () => {
    const names = toolNames(makeSession(), ["add_task", "search_components"]);
    expect(names).toEqual(["add_task", "search_components"]);
  });

  it("ignores unknown tool names", () => {
    const names = toolNames(makeSession(), ["add_task", "does_not_exist"]);
    expect(names).toEqual(["add_task"]);
  });

  it("describes the exact tool subset and applies resolved thinking depth", () => {
    const agent = buildRemoteEditorAgent(makeSession(), {
      tools: ["get_pipeline_state"],
      systemPrompt: "",
      thinkingDepth: "off",
    });

    expect(agent.instructions).toContain(
      "You have exactly these tools: `get_pipeline_state`.",
    );
    expect(agent.instructions).toContain(
      "Do not attempt workflow steps that require a tool outside this list.",
    );
    expect(agent.modelSettings.reasoning).toEqual({ effort: "none" });
  });
});

describe("describeToolGrant", () => {
  it("separates what was granted from what this build has and was not asked for", () => {
    const grant = describeToolGrant(makeSession(), [
      "add_task",
      "get_pipeline_state",
    ]);

    expect(grant.granted).toEqual(["get_pipeline_state", "add_task"]);
    expect(grant.withheld).toContain("auto_layout");
    expect(grant.withheld).not.toContain("add_task");
    expect(grant.unknown).toEqual([]);
  });

  /**
   * The reported case: the canvas tools exist here and the server never asked
   * for them, so the agent said auto-layout and sticky notes were unavailable.
   */
  it("names the canvas tools an allowlist that predates them leaves out", () => {
    const grant = describeToolGrant(makeSession(), ["add_task"]);

    expect(grant.withheld).toEqual(
      expect.arrayContaining([
        "auto_layout",
        "add_sticky_note",
        "update_sticky_note",
        "delete_sticky_note",
      ]),
    );
  });

  /** The mirror failure: asked for something this build cannot supply. */
  it("reports a requested tool this build does not have", () => {
    const grant = describeToolGrant(makeSession(), ["teleport_task"]);

    expect(grant.unknown).toEqual(["teleport_task"]);
    expect(grant.granted).toEqual([]);
  });

  it("describes the read-only registry when the host is a run view", () => {
    const grant = describeToolGrant(
      makeSession({ mode: "runView", runId: "42" }),
      ["get_run_status"],
    );

    expect(grant.granted).toEqual(["get_run_status"]);
    expect(grant.withheld).not.toContain("add_task");
  });
});

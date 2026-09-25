import { describe, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";

import {
  createActiveTabRoutingBridge,
  createAgentTargetRouter,
} from "./createActiveTabRoutingBridge";

function fakeBridge(name: string) {
  return {
    setPipelineName: vi.fn(async () => `${name}:renamed`),
    getPipelineState: vi.fn(async () => name),
  } as unknown as ToolBridgeApi;
}

describe("createActiveTabRoutingBridge", () => {
  it("forwards to whichever bridge is active at call time", async () => {
    let active = fakeBridge("a");
    const bridge = createActiveTabRoutingBridge(() => active);

    await expect(bridge.getPipelineState()).resolves.toBe("a");
    active = fakeBridge("b");
    await expect(bridge.getPipelineState()).resolves.toBe("b");
  });

  it("throws a usable message when nothing is open", async () => {
    const bridge = createActiveTabRoutingBridge(() => undefined);

    await expect(() => bridge.getPipelineState()).toThrow(
      /No pipeline or run is open/,
    );
  });
});

describe("createAgentTargetRouter", () => {
  it("holds a turn on the tab it started against", async () => {
    let active = fakeBridge("a");
    const router = createAgentTargetRouter(() => active);
    const bridge = router.bridgeFor("agent-1");

    router.pinTurn("agent-1");
    await expect(bridge.getPipelineState()).resolves.toBe("a");

    active = fakeBridge("b");
    await expect(bridge.getPipelineState()).resolves.toBe("a");
    await expect(bridge.setPipelineName("x")).resolves.toBe("a:renamed");
  });

  it("re-targets on the next turn", async () => {
    let active = fakeBridge("a");
    const router = createAgentTargetRouter(() => active);
    const bridge = router.bridgeFor("agent-1");

    router.pinTurn("agent-1");
    await expect(bridge.getPipelineState()).resolves.toBe("a");

    active = fakeBridge("b");
    router.pinTurn("agent-1");
    await expect(bridge.getPipelineState()).resolves.toBe("b");
  });

  it("pins each agent independently while their turns overlap", async () => {
    let active = fakeBridge("a");
    const router = createAgentTargetRouter(() => active);
    const first = router.bridgeFor("agent-1");
    const second = router.bridgeFor("agent-2");

    router.pinTurn("agent-1");
    active = fakeBridge("b");
    router.pinTurn("agent-2");

    await expect(first.getPipelineState()).resolves.toBe("a");
    await expect(second.getPipelineState()).resolves.toBe("b");
  });

  it("falls back to the active tab before a turn is pinned", async () => {
    const router = createAgentTargetRouter(() => fakeBridge("a"));

    await expect(router.bridgeFor("agent-1").getPipelineState()).resolves.toBe(
      "a",
    );
  });

  it("drops the pin when the agent is forgotten", async () => {
    let active = fakeBridge("a");
    const router = createAgentTargetRouter(() => active);
    const bridge = router.bridgeFor("agent-1");

    router.pinTurn("agent-1");
    active = fakeBridge("b");
    router.forget("agent-1");

    await expect(bridge.getPipelineState()).resolves.toBe("b");
  });
});

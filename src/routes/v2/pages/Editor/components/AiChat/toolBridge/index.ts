/**
 * Main-thread implementation of the agent's `ToolBridgeApi`.
 *
 * Each handler factory owns one slice of the contract — CSOM spec
 * mutations, run lifecycle, and read-only debug fetches — and returns
 * a `Pick<ToolBridgeApi, ...>` typed object so any drift between a
 * slice and the contract surfaces here at the spread site.
 *
 * The composed object is intended to be exposed to the worker via
 * `Comlink.proxy()`. The bridge owns no React or MobX subscriptions of
 * its own; every method reads the live spec / backend / auth values
 * through `BridgeDeps` callbacks so navigation, backend, and auth
 * changes are picked up without rebuilding the bridge.
 */
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";

import { createCsomBridgeHandlers } from "./csomBridge";
import { createDebugBridgeHandlers } from "./debugBridge";
import { createRunBridgeHandlers } from "./runBridge";
import type { BridgeDeps } from "./utils";

export type { BridgeDeps } from "./utils";

export function createToolBridge(deps: BridgeDeps): ToolBridgeApi {
  return {
    ...createCsomBridgeHandlers(deps),
    ...createRunBridgeHandlers(deps),
    ...createDebugBridgeHandlers(deps),
  };
}

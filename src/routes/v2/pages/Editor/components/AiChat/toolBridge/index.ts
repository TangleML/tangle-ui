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
 * its own. Each turn receives a document-scoped bridge; mutation handlers
 * verify that the captured document is still current before changing it.
 */
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { createComponentSearchBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/componentSearchBridge";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import { createSubgraphBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/subgraphBridge";

import type { CsomBridgeDeps } from "./csomBridge";
import { createCsomBridgeHandlers } from "./csomBridge";

export type EditorToolBridgeDeps = CsomBridgeDeps;

/**
 * Full Editor bridge — shared run/debug handlers plus the Editor's
 * spec-mutating CSOM handlers (which require the undo store).
 */
export function createEditorToolBridge(
  deps: EditorToolBridgeDeps,
): ToolBridgeApi {
  const scopedDeps = {
    ...deps,
    undo: {
      withGroup<T>(label: string, fn: () => T): T {
        deps.assertCurrentDocument?.();
        return deps.undo.withGroup(label, fn);
      },
    },
  };
  return {
    ...createCsomBridgeHandlers(scopedDeps),
    ...createSubgraphBridgeHandlers(scopedDeps),
    ...createComponentSearchBridgeHandlers(scopedDeps),
    ...createRunBridgeHandlers(scopedDeps),
    ...createDebugBridgeHandlers(scopedDeps),
  };
}

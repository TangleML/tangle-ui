import type { ToolBridgeApi } from "@/agent/toolBridgeApi";

import type { BridgeDeps } from "./utils";

export function createDocumentScopedBridge(
  createBridge: (deps: BridgeDeps) => ToolBridgeApi,
  deps: BridgeDeps,
  signal: AbortSignal,
): ToolBridgeApi {
  const document = deps.getSpec();
  const assertCurrentDocument = () => {
    signal.throwIfAborted();
    if (deps.getSpec() !== document) {
      throw new Error(
        "The open pipeline changed. Send a new message to continue.",
      );
    }
  };
  const checked =
    <T>(read: () => T) =>
    () => {
      assertCurrentDocument();
      return read();
    };
  const bridge = createBridge({
    ...deps,
    assertCurrentDocument,
    getSpec: checked(deps.getSpec),
    getActiveSpec: deps.getActiveSpec && checked(deps.getActiveSpec),
    getActiveSubgraphPath: checked(deps.getActiveSubgraphPath),
    getActiveSubgraphTaskId: checked(deps.getActiveSubgraphTaskId),
    getNodes: deps.getNodes && checked(deps.getNodes),
    getEdges: deps.getEdges && checked(deps.getEdges),
    getBackendUrl: deps.getBackendUrl && checked(deps.getBackendUrl),
    getAuthToken: deps.getAuthToken && checked(deps.getAuthToken),
    getRunAnnotations:
      deps.getRunAnnotations && checked(deps.getRunAnnotations),
  });
  return new Proxy(bridge, {
    get(target, key, receiver) {
      const method = Reflect.get(target, key, receiver);
      if (typeof method !== "function") return method;
      return async (...args: unknown[]) => {
        assertCurrentDocument();
        return Reflect.apply(method, target, args);
      };
    },
  });
}

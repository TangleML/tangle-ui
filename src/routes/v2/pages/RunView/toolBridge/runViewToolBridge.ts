/** Run inspection shares the read-only pipeline handlers. */
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { createDebugBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/debugBridge";
import { createReadOnlyCsomHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/readOnlyToolBridge";
import { createRunBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/runBridge";
import { createSubgraphBridgeHandlers } from "@/routes/v2/shared/components/AiChat/toolBridge/subgraphBridge";
import type { BridgeDeps } from "@/routes/v2/shared/components/AiChat/toolBridge/utils";

export function createRunViewToolBridge(deps: BridgeDeps): ToolBridgeApi {
  return {
    ...createReadOnlyCsomHandlers(deps),
    ...createSubgraphBridgeHandlers(deps),
    ...createRunBridgeHandlers(deps),
    ...createDebugBridgeHandlers(deps),
  };
}

import { EmbeddedRunView } from "@/routes/v2/pages/RunView/EmbeddedRunView";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";

registerWorkareaKind({
  type: "run",
  icon: "Play",
  keepMounted: true,
  resolveTitle: (target) => `Run ${parseIdentity(target.identity).value}`,
  render: (tab, hostProps) => {
    const runId = parseIdentity(tab.target.identity).value;
    return (
      <EmbeddedRunView
        runId={runId}
        projectId={hostProps.projectId}
        onStoreReady={(store) => hostProps.registerTabStore(tab.id, store)}
        onStoreClosed={() => hostProps.unregisterTabStore(tab.id)}
        sessionId={hostProps.sessionId}
        environmentId={hostProps.tabEnvironmentId(tab.id)}
        onEnvironmentReady={(environmentId) =>
          hostProps.registerTabEnvironment(tab.id, environmentId)
        }
        onEnvironmentClosed={() => hostProps.unregisterTabEnvironment(tab.id)}
        onBridgeReady={(bridge) =>
          hostProps.registerTabBridge(tab.id, "run", bridge)
        }
        onBridgeClosed={() => hostProps.unregisterTabBridge(tab.id)}
      />
    );
  },
});

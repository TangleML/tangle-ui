import { EmbeddedRunView } from "@/routes/v2/pages/RunView/EmbeddedRunView";

import { registerWorkareaKind } from "./registry";
import { parseIdentity } from "./workareaTarget";

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
        isActive={hostProps.isActive}
        onStoreReady={(store) => hostProps.registerTabStore(tab.id, store)}
        onStoreClosed={() => hostProps.unregisterTabStore(tab.id)}
      />
    );
  },
});

import { EmbeddedRunView } from "@/routes/v2/pages/RunView/EmbeddedRunView";

import { registerWorkareaKind } from "./registry";

registerWorkareaKind({
  kind: "run",
  icon: "Play",
  keepMounted: true,
  render: (tab, hostProps) => {
    if (tab.kind !== "run") return null;
    return (
      <EmbeddedRunView
        runId={tab.runId}
        isActive={hostProps.isActive}
        onStoreReady={(store) => hostProps.registerTabStore(tab.id, store)}
        onStoreClosed={() => hostProps.unregisterTabStore(tab.id)}
      />
    );
  },
});

import { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";

import { registerWorkareaKind } from "./registry";

registerWorkareaKind({
  kind: "pipeline",
  icon: "Workflow",
  keepMounted: true,
  render: (tab, hostProps) => {
    if (tab.kind !== "pipeline") return null;
    return (
      <EmbeddedPipelineEditor
        pipelineRef={tab.pipelineRef}
        isActive={hostProps.isActive}
        onStoreReady={(store) => hostProps.registerTabStore(tab.id, store)}
        onStoreClosed={() => hostProps.unregisterTabStore(tab.id)}
      />
    );
  },
});

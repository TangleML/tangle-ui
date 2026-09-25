import { EmbeddedPipelineEditor } from "@/routes/v2/pages/Editor/EmbeddedPipelineEditor";
import { findById } from "@/services/pipelineStorage/pipelineRegistry";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTarget } from "./types";
import { parseIdentity } from "./workareaTarget";

function toPipelineRef(target: WorkareaTarget, title: string): PipelineRef {
  const { key, value } = parseIdentity(target.identity);
  if (key === "id") return { fileId: value, name: title };
  return { name: value };
}

registerWorkareaKind({
  type: "pipeline",
  icon: "Workflow",
  keepMounted: true,
  resolveTitle: async (target) => {
    const { key, value } = parseIdentity(target.identity);
    if (key === "name") return value;
    const entry = await findById(value).catch(() => undefined);
    return entry?.storageKey ?? value;
  },
  render: (tab, hostProps) => (
    <EmbeddedPipelineEditor
      pipelineRef={toPipelineRef(tab.target, tab.title)}
      isActive={hostProps.isActive}
      onStoreReady={(store) => hostProps.registerTabStore(tab.id, store)}
      onStoreClosed={() => hostProps.unregisterTabStore(tab.id)}
    />
  ),
});

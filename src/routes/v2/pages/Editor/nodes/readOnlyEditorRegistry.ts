import { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";

import { editorRegistry } from "./index";

export const readOnlyEditorRegistry = new NodeTypeRegistry();

for (const manifest of editorRegistry.all()) {
  if (manifest.type === "ghost") continue;
  readOnlyEditorRegistry.register({
    ...manifest,
    drop: undefined,
    cloneHandler: undefined,
    onPaneClick: undefined,
    useCanvasEnhancement: undefined,
    updatePosition() {},
    deleteNode() {},
    buildNodes(spec) {
      return manifest.buildNodes(spec).map((node) => ({
        ...node,
        draggable: false,
        deletable: false,
        connectable: false,
        data: { ...node.data, readOnly: true },
      }));
    },
  });
}

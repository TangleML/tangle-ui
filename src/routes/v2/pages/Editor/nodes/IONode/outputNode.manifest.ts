import { Annotations } from "@/models/componentSpec/annotations";
import { Output } from "@/models/componentSpec/entities/output";
import { addOutput } from "@/routes/v2/pages/Editor/store/actions";
import { generateUniqueOutputName } from "@/routes/v2/pages/Editor/store/nameUtils";
import { outputManifestBase } from "@/routes/v2/shared/nodes/IONode/outputManifestBase";
import type {
  NodeTypeManifest,
  OutputNodeSnapshot,
} from "@/routes/v2/shared/nodes/types";
import { deepClone } from "@/utils/deepClone";

import { OutputDetails } from "./context/OutputDetails";

export const outputManifest: NodeTypeManifest = {
  ...outputManifestBase,

  drop: {
    dataKey: "output",
    handler(spec, _data, position, undo) {
      addOutput(undo, spec, position);
    },
  },

  updatePosition(_undo, spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(_undo, spec, nodeId) {
    spec.deleteOutputById(nodeId);
  },

  contextPanelComponent: OutputDetails,

  cloneHandler: {
    snapshot(spec, entityId) {
      const output = spec.outputs.find((o) => o.$id === entityId);
      if (!output) return null;

      const nonEditorAnnotations = output.annotations.items
        .filter((a) => !a.key.startsWith("editor."))
        .map((a) => deepClone(a));

      return {
        entityId: output.$id,
        type: "output",
        name: output.name,
        position: output.annotations.get("editor.position"),
        data: {
          type: output.type ? deepClone(output.type) : undefined,
          description: output.description,
          annotations: nonEditorAnnotations,
        },
      } satisfies OutputNodeSnapshot;
    },

    clone(spec, snapshot, idGen, position, _undo) {
      if (snapshot.type !== "output") return null;
      const { data } = snapshot as OutputNodeSnapshot;
      const uniqueName = generateUniqueOutputName(spec, snapshot.name);

      const output = new Output({
        $id: idGen.next("output"),
        name: uniqueName,
        type: data.type ? deepClone(data.type) : undefined,
        description: data.description,
        annotations: Annotations.from([
          ...data.annotations,
          { key: "editor.position", value: position },
        ]),
      });

      spec.addOutput(output);
      return output.$id;
    },
  },
};

import { Annotations } from "@/models/componentSpec/annotations";
import { Output } from "@/models/componentSpec/entities/output";
import { addOutput } from "@/routes/v2/pages/Editor/store/actions";
import { deleteOutput } from "@/routes/v2/pages/Editor/store/actions/io.actions";
import { generateUniqueOutputName } from "@/routes/v2/pages/Editor/store/nameUtils";
import {
  isOutputSnapshot,
  outputManifestBase,
  snapshotOutput,
} from "@/routes/v2/shared/nodes/IONode/outputManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";
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

  deleteNode(undo, spec, nodeId, parentContext) {
    deleteOutput(undo, spec, nodeId, parentContext);
  },

  contextPanelComponent: OutputDetails,

  cloneHandler: {
    snapshot: snapshotOutput,

    clone(spec, snapshot, idGen, position, _undo) {
      if (!isOutputSnapshot(snapshot)) return null;

      const uniqueName = generateUniqueOutputName(spec, snapshot.name);
      const output = new Output({
        $id: idGen.next("output"),
        name: uniqueName,
        type: snapshot.data.type ? deepClone(snapshot.data.type) : undefined,
        description: snapshot.data.description,
        annotations: Annotations.from([
          ...snapshot.data.annotations,
          { key: "editor.position", value: position },
        ]),
      });

      spec.addOutput(output);
      return output.$id;
    },
  },
};

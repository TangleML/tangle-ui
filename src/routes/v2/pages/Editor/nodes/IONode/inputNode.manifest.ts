import { Annotations } from "@/models/componentSpec/annotations";
import { Input } from "@/models/componentSpec/entities/input";
import { addInput } from "@/routes/v2/pages/Editor/store/actions";
import { deleteInput } from "@/routes/v2/pages/Editor/store/actions/io.actions";
import { generateUniqueInputName } from "@/routes/v2/pages/Editor/store/nameUtils";
import {
  inputManifestBase,
  isInputSnapshot,
  snapshotInput,
} from "@/routes/v2/shared/nodes/IONode/inputManifestBase";
import type { NodeTypeManifest } from "@/routes/v2/shared/nodes/types";
import { deepClone } from "@/utils/deepClone";

import { InputDetails } from "./context/InputDetails";

export const inputManifest: NodeTypeManifest = {
  ...inputManifestBase,

  drop: {
    dataKey: "input",
    handler(spec, _data, position, undo) {
      addInput(undo, spec, position);
    },
  },

  updatePosition(_undo, spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(undo, spec, nodeId, parentContext) {
    deleteInput(undo, spec, nodeId, parentContext);
  },

  contextPanelComponent: InputDetails,

  cloneHandler: {
    snapshot: snapshotInput,

    clone(spec, snapshot, idGen, position, _undo) {
      if (!isInputSnapshot(snapshot)) return null;

      const uniqueName = generateUniqueInputName(spec, snapshot.name);
      const input = new Input({
        $id: idGen.next("input"),
        name: uniqueName,
        type: snapshot.data.type ? deepClone(snapshot.data.type) : undefined,
        description: snapshot.data.description,
        defaultValue: snapshot.data.defaultValue,
        optional: snapshot.data.optional,
        annotations: Annotations.from([
          ...snapshot.data.annotations,
          { key: "editor.position", value: position },
        ]),
      });

      spec.addInput(input);
      return input.$id;
    },
  },
};

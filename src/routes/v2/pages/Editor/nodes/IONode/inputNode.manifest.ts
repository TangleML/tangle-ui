import { Annotations } from "@/models/componentSpec/annotations";
import { Input } from "@/models/componentSpec/entities/input";
import { addInput } from "@/routes/v2/pages/Editor/store/actions";
import { generateUniqueInputName } from "@/routes/v2/pages/Editor/store/nameUtils";
import { inputManifestBase } from "@/routes/v2/shared/nodes/IONode/inputManifestBase";
import type {
  InputNodeSnapshot,
  NodeTypeManifest,
} from "@/routes/v2/shared/nodes/types";
import { deepClone } from "@/utils/deepClone";

import { InputDetails } from "./context/InputDetails";

export const inputManifest: NodeTypeManifest = {
  ...inputManifestBase,

  drop: {
    dataKey: "input",
    handler(spec, _data, position) {
      addInput(spec, position);
    },
  },

  updatePosition(spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(spec, nodeId) {
    spec.deleteInputById(nodeId);
  },

  contextPanelComponent: InputDetails,

  cloneHandler: {
    snapshot(spec, entityId) {
      const input = spec.inputs.find((i) => i.$id === entityId);
      if (!input) return null;

      const nonEditorAnnotations = input.annotations.items
        .filter((a) => !a.key.startsWith("editor."))
        .map((a) => deepClone(a));

      return {
        entityId: input.$id,
        type: "input",
        name: input.name,
        position: input.annotations.get("editor.position"),
        data: {
          type: input.type ? deepClone(input.type) : undefined,
          description: input.description,
          defaultValue: input.defaultValue,
          optional: input.optional,
          annotations: nonEditorAnnotations,
        },
      } satisfies InputNodeSnapshot;
    },

    clone(spec, snapshot, idGen, position) {
      if (snapshot.type !== "input") return null;
      const { data } = snapshot as InputNodeSnapshot;
      const uniqueName = generateUniqueInputName(spec, snapshot.name);

      const input = new Input({
        $id: idGen.next("input"),
        name: uniqueName,
        type: data.type ? deepClone(data.type) : undefined,
        description: data.description,
        defaultValue: data.defaultValue,
        optional: data.optional,
        annotations: Annotations.from([
          ...data.annotations,
          { key: "editor.position", value: position },
        ]),
      });

      spec.addInput(input);
      return input.$id;
    },
  },
};

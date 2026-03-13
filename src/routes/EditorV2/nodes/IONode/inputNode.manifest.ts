import { Annotations } from "@/models/componentSpec/annotations";
import { Input } from "@/models/componentSpec/entities/input";

import { addInput } from "../../store/actions";
import { generateUniqueInputName } from "../../store/nameUtils";
import type { InputNodeSnapshot } from "../../store/nodeCloneHandlers";
import { createEntityNode, ioDefaultPosition } from "../buildUtils";
import type { IONodeData } from "../types";
import type { NodeTypeManifest } from "../types";
import { IONode } from "./components/IONode";
import { InputDetails } from "./context/InputDetails";

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const inputManifest: NodeTypeManifest = {
  type: "io",
  idPrefix: "input_",
  entityType: "input",

  component: IONode,

  buildNodes(spec) {
    return [...spec.inputs].map((input, index) =>
      createEntityNode(input, "io", ioDefaultPosition(index, -200), {
        entityId: input.$id,
        ioType: "input",
        name: input.name,
      } satisfies IONodeData),
    );
  },

  fingerprintParts(spec) {
    return [...spec.inputs].map((input) => {
      const pos = input.annotations.get("editor.position");
      return `i:${input.$id}:${input.name}:${pos.x},${pos.y}`;
    });
  },

  drop: {
    dataKey: "input",
    handler(spec, _data, position) {
      addInput(spec, position);
    },
  },

  getPosition(spec, nodeId) {
    const input = spec.inputs.find((i) => i.$id === nodeId);
    if (!input) return undefined;
    return input.annotations.get("editor.position");
  },

  updatePosition(spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(spec, nodeId) {
    spec.deleteInputById(nodeId);
  },

  findEntity(spec, entityId) {
    return spec.inputs.find((i) => i.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "input", position: node.position };
  },

  contextPanelComponent: InputDetails,

  displayName(spec, entityId) {
    const input = spec.inputs.find((i) => i.$id === entityId);
    return input?.name ?? entityId;
  },

  icon: "Download",
  iconColor: "text-blue-500",

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

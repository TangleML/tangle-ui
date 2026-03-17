import { Annotations } from "@/models/componentSpec/annotations";
import { Output } from "@/models/componentSpec/entities/output";

import { addOutput } from "../../store/actions";
import { generateUniqueOutputName } from "../../store/nameUtils";
import type { OutputNodeSnapshot } from "../../store/nodeCloneHandlers";
import { createEntityNode, ioDefaultPosition } from "../buildUtils";
import type { IONodeData, NodeTypeManifest } from "../types";
import { IONode } from "./components/IONode";
import { OutputDetails } from "./context/OutputDetails";

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const outputManifest: NodeTypeManifest = {
  type: "io",
  idPrefix: "output_",
  entityType: "output",

  component: IONode,

  buildNodes(spec) {
    return [...spec.outputs].map((output, index) =>
      createEntityNode(output, "io", ioDefaultPosition(index, 800), {
        entityId: output.$id,
        ioType: "output",
        name: output.name,
      } satisfies IONodeData),
    );
  },

  fingerprintParts(spec) {
    return [...spec.outputs].map((output) => {
      const pos = output.annotations.get("editor.position");
      const z = output.annotations.get("zIndex");
      return `o:${output.$id}:${output.name}:${pos.x},${pos.y}:z${z ?? ""}`;
    });
  },

  drop: {
    dataKey: "output",
    handler(spec, _data, position) {
      addOutput(spec, position);
    },
  },

  getPosition(spec, nodeId) {
    const output = spec.outputs.find((o) => o.$id === nodeId);
    if (!output) return undefined;
    return output.annotations.get("editor.position");
  },

  updatePosition(spec, nodeId, position) {
    spec.updateNodePosition(nodeId, position);
  },

  deleteNode(spec, nodeId) {
    spec.deleteOutputById(nodeId);
  },

  findEntity(spec, entityId) {
    return spec.outputs.find((o) => o.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "output", position: node.position };
  },

  contextPanelComponent: OutputDetails,

  displayName(spec, entityId) {
    const output = spec.outputs.find((o) => o.$id === entityId);
    return output?.name ?? entityId;
  },

  icon: "Upload",
  iconColor: "text-green-500",

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

    clone(spec, snapshot, idGen, position) {
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

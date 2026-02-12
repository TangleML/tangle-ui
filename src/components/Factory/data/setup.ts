import { type Node } from "@xyflow/react";

import { BUILDINGS } from "./buildings";

// Initial marketplace node at the center
const MARKETPLACE_NODE: Node = {
  id: "marketplace",
  type: "building",
  position: { x: 0, y: 0 },
  data: { ...BUILDINGS.find((b) => b.id === "marketplace") },
  draggable: false,
  deletable: false,
  selectable: true,
};

const buildings = [MARKETPLACE_NODE];

export const setup = {
  buildings,
};

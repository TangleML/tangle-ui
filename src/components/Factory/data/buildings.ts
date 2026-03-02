import { Position } from "@xyflow/react";

import type { Building } from "../types/buildings";

export const BUILDINGS: Building[] = [
  {
    id: "marketplace",
    name: "Marketplace",
    icon: "🏛️",
    description: "Sell goods here",
    cost: 0,
    color: "#FBBF24",
    inputs: [
      { resource: "any", position: Position.Left },
      { resource: "any", position: Position.Right },
      { resource: "any", position: Position.Top },
      { resource: "any", position: Position.Bottom },
    ],
  },
  {
    id: "woodcutter",
    name: "Woodcutter's Camp",
    icon: "🪓",
    description: "Produces wood",
    cost: 0,
    color: "#A0522D",
    outputs: [{ resource: "wood", position: Position.Right }],
  },
  {
    id: "quarry",
    name: "Quarry",
    icon: "⛏️",
    description: "Produces stone",
    cost: 0,
    color: "#708090",
    outputs: [{ resource: "stone", position: Position.Right }],
  },
  {
    id: "farm",
    name: "Farm",
    icon: "🌾",
    description: "Produces wheat",
    cost: 0,
    color: "#228B22",
    outputs: [{ resource: "wheat", position: Position.Right }],
  },
];

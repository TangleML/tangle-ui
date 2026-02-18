import type { Building } from "./types";

export const BUILDINGS: Building[] = [
  {
    id: "marketplace",
    name: "Marketplace",
    icon: "🏛️",
    description: "Sell goods here",
    cost: 0,
    color: "#FBBF24",
  },
  {
    id: "woodcutter",
    name: "Woodcutter's Camp",
    icon: "🪓",
    description: "Produces wood",
    cost: 0,
    color: "#A0522D",
  },
  {
    id: "quarry",
    name: "Quarry",
    icon: "⛏️",
    description: "Produces stone",
    cost: 0,
    color: "#708090",
  },
  {
    id: "farm",
    name: "Farm",
    icon: "🌾",
    description: "Produces wheat",
    cost: 0,
    color: "#228B22",
  },
];

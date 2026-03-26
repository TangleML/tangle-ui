import type { BuildingClass } from "../types/buildings";

export const BUILDINGS: Record<string, BuildingClass> = {
  marketplace: {
    name: "Marketplace",
    icon: "🏛️",
    description: "Sell goods here",
    cost: 0,
    color: "#FBBF24",
    productionMethods: [
      {
        name: "Trading",
        inputs: [{ resource: "any", amount: 100, nodes: 4 }],
        outputs: [{ resource: "money", amount: 1 }],
        days: 1,
      },
    ],
  },
  woodcutter: {
    name: "Woodcutter's Camp",
    icon: "🪓",
    description: "Produces wood",
    cost: 0,
    color: "#A0522D",
    productionMethods: [
      {
        name: "Hand Axes",
        inputs: [],
        outputs: [{ resource: "wood", amount: 10 }],
        days: 1,
      },
    ],
  },
  quarry: {
    name: "Quarry",
    icon: "⛏️",
    description: "Produces stone",
    cost: 0,
    color: "#708090",
    productionMethods: [
      {
        name: "Hand Axes",
        inputs: [],
        outputs: [{ resource: "stone", amount: 5 }],
        days: 1,
      },
    ],
  },
  farm: {
    name: "Farm",
    icon: "🌾",
    description: "Produces wheat",
    cost: 0,
    color: "#228B22",
    productionMethods: [
      {
        name: "Wheat",
        inputs: [],
        outputs: [{ resource: "wheat", amount: 60 }],
        days: 3,
      },
    ],
  },
  sawmill: {
    name: "Sawmill",
    icon: "🏭",
    description: "Turns wood into planks",
    cost: 0,
    color: "#D2691E",
    productionMethods: [
      {
        name: "Sandpaper and Hand Saw",
        inputs: [{ resource: "wood", amount: 40, nodes: 2 }],
        outputs: [{ resource: "planks", amount: 20 }],
        days: 2,
      },
    ],
  },
  papermill: {
    name: "Papermill",
    icon: "🏭",
    description: "Turns wood into paper",
    cost: 0,
    color: "#6A5ACD",
    productionMethods: [
      {
        name: "Pulp and Press",
        inputs: [{ resource: "wood", amount: 20 }],
        outputs: [{ resource: "paper", amount: 50 }],
        days: 3,
      },
    ],
  },
  pasture: {
    name: "Pasture",
    icon: "🐄",
    description: "Turns wheat into livestock",
    cost: 0,
    color: "#A52A2A",
    productionMethods: [
      {
        name: "Free Range Grazing",
        inputs: [{ resource: "wheat", amount: 25 }],
        outputs: [{ resource: "livestock", amount: 1 }],
        days: 10,
      },
    ],
  },
  butchery: {
    name: "Butchery",
    icon: "🔪",
    description: "Processes livestock",
    cost: 0,
    color: "#8B0000",
    productionMethods: [
      {
        name: "Carving Knives",
        inputs: [{ resource: "livestock", amount: 1 }],
        outputs: [
          { resource: "meat", amount: 6 },
          { resource: "leather", amount: 2 },
        ],
        days: 3,
      },
    ],
  },
  bookbinder: {
    name: "Bookbinder",
    icon: "📚",
    description: "Produces books",
    cost: 0,
    color: "#4B0082",
    productionMethods: [
      {
        name: "Bookbinding",
        inputs: [
          { resource: "paper", amount: 20 },
          { resource: "leather", amount: 2 },
        ],
        outputs: [{ resource: "books", amount: 1 }],
        days: 5,
      },
    ],
  },
  library: {
    name: "Library",
    icon: "🏛️",
    description: "Centre of knowledge",
    cost: 0,
    color: "#483D8B",
    productionMethods: [
      {
        name: "Writing",
        inputs: [{ resource: "paper", amount: 40, nodes: 4 }],
        outputs: [{ resource: "knowledge", amount: 1 }],
        days: 1,
      },
      {
        name: "Reading",
        inputs: [{ resource: "books", amount: 10, nodes: 2 }],
        outputs: [{ resource: "knowledge", amount: 1 }],
        days: 1,
      },
    ],
  },
  mill: {
    name: "Mill",
    icon: "🏭",
    description: "Grinds wheat into flour",
    cost: 0,
    color: "#DAA520",
    productionMethods: [
      {
        name: "Grinding Stones",
        inputs: [{ resource: "wheat", amount: 40 }],
        outputs: [{ resource: "flour", amount: 20 }],
        days: 4,
      },
    ],
  },
  kiln: {
    name: "Kiln",
    icon: "🏭",
    description: "Burns wood into coal",
    cost: 0,
    color: "#36454F",
    productionMethods: [
      {
        name: "Charcoal Burning",
        inputs: [{ resource: "wood", amount: 50 }],
        outputs: [{ resource: "coal", amount: 50 }],
        days: 2,
      },
    ],
  },
  bakery: {
    name: "Bakery",
    icon: "🍞",
    description: "Bakes flour into bread",
    cost: 0,
    color: "#F5DEB3",
    productionMethods: [
      {
        name: "Oven Baking",
        inputs: [
          { resource: "flour", amount: 10 },
          { resource: "coal", amount: 10 },
        ],
        outputs: [{ resource: "bread", amount: 10 }],
        days: 2,
      },
    ],
  },
  bank: {
    name: "Bank",
    icon: "🏦",
    description: "Generates money over time",
    cost: 100,
    color: "#FFD700",
    productionMethods: [
      {
        name: "Minting",
        inputs: [],
        outputs: [{ resource: "money", amount: 5 }],
        days: 3,
      },
    ],
  },
} as const satisfies Record<string, BuildingClass>;

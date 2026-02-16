import type { BuildingClass } from "../types/buildings";

export const SPECIAL_BUILDINGS = ["firepit", "marketplace", "granary"]; // Buildings with special processing logic that doesn't fit the standard production model

export const BUILDINGS: Record<string, BuildingClass> = {
  firepit: {
    name: "Firepit",
    icon: "🔥",
    description: "The centre of civilization",
    cost: 0,
    color: "#FF4500",
    category: "special",
    productionMethods: [
      {
        name: "Survival",
        inputs: [
          { resource: "berries", amount: 20 },
          { resource: "fish", amount: 10 },
          { resource: "meat", amount: 5 },
        ],
        outputs: [
          { resource: "food", amount: 1 },
          { resource: "knowledge", amount: 1 },
        ],
        days: 1,
      },
    ],
  },
  marketplace: {
    name: "Marketplace",
    icon: "💲",
    description: "Sell low, buy high!",
    cost: 0,
    color: "#FBBF24",
    category: "special",
    productionMethods: [
      {
        name: "Trading",
        inputs: [{ resource: "any", amount: 100, nodes: 4 }],
        outputs: [{ resource: "money", amount: 1 }],
        days: 1,
      },
    ],
  },
  library: {
    name: "Library",
    icon: "🎓",
    description: "Nexus of knowledge",
    cost: 0,
    color: "#483D8B",
    category: "special",
    productionMethods: [
      {
        name: "Writing",
        inputs: [{ resource: "paper", amount: 80, nodes: 4 }],
        outputs: [{ resource: "knowledge", amount: 1 }],
        days: 2,
      },
      {
        name: "Reading",
        inputs: [{ resource: "books", amount: 2, nodes: 2 }],
        outputs: [{ resource: "knowledge", amount: 1 }],
        days: 1,
      },
    ],
  },
  well: {
    name: "Well",
    icon: "💧",
    description: "Provides water",
    cost: 0,
    color: "#1E90FF",
    category: "production",
    productionMethods: [
      {
        name: "Drawing Water",
        inputs: [],
        outputs: [{ resource: "water", amount: 100, nodes: 4 }],
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
    category: "production",
    productionMethods: [
      {
        name: "Gathering Sticks",
        inputs: [],
        outputs: [{ resource: "wood", amount: 10 }],
        days: 1,
      },
      {
        name: "Stone Axes",
        inputs: [{ resource: "stone", amount: 1 }],
        outputs: [{ resource: "wood", amount: 20 }],
        days: 1,
      },
      {
        name: "Hand Saw",
        inputs: [{ resource: "tools", amount: 2 }],
        outputs: [{ resource: "wood", amount: 50, nodes: 2 }],
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
    category: "production",
    productionMethods: [
      {
        name: "Gathering Stones",
        inputs: [],
        outputs: [{ resource: "stone", amount: 5 }],
        days: 1,
      },
      {
        name: "Hammer and Chisel",
        inputs: [{ resource: "tools", amount: 2 }],
        outputs: [{ resource: "stone", amount: 20, nodes: 2 }],
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
    category: "production",
    productionMethods: [
      {
        name: "Wheat",
        inputs: [],
        outputs: [{ resource: "wheat", amount: 60 }],
        days: 3,
      },
      {
        name: "Orchard",
        inputs: [],
        outputs: [{ resource: "berries", amount: 100, nodes: 4 }],
        days: 2,
      },
      {
        name: "Irrigation",
        inputs: [{ resource: "water", amount: 60, nodes: 3 }],
        outputs: [{ resource: "wheat", amount: 200, nodes: 4 }],
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
    category: "refining",
    productionMethods: [
      {
        name: "Sandpaper and Saw",
        inputs: [
          { resource: "wood", amount: 40, nodes: 2 },
          { resource: "tools", amount: 1 },
        ],
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
    category: "refining",
    productionMethods: [
      {
        name: "Pulp and Press",
        inputs: [{ resource: "wood", amount: 20 }],
        outputs: [{ resource: "paper", amount: 50, nodes: 2 }],
        days: 3,
      },
    ],
  },
  pasture: {
    name: "Pasture",
    icon: "🐄",
    description: "Raises livestock",
    cost: 0,
    color: "#A52A2A",
    category: "production",
    productionMethods: [
      {
        name: "Grazing",
        inputs: [{ resource: "wheat", amount: 25 }],
        outputs: [{ resource: "livestock", amount: 1 }],
        days: 10,
      },
      {
        name: "Feeding",
        inputs: [
          { resource: "wheat", amount: 10 },
          { resource: "water", amount: 20 },
        ],
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
    category: "refining",
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
    category: "refining",
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
  mill: {
    name: "Mill",
    icon: "🏭",
    description: "Grinds wheat into flour",
    cost: 0,
    color: "#DAA520",
    category: "refining",
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
    category: "refining",
    productionMethods: [
      {
        name: "Charcoal Burning",
        inputs: [{ resource: "wood", amount: 50, nodes: 2 }],
        outputs: [{ resource: "coal", amount: 50, nodes: 2 }],
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
    category: "refining",
    productionMethods: [
      {
        name: "Oven Baking",
        inputs: [
          { resource: "flour", amount: 10 },
          { resource: "water", amount: 10 },
          { resource: "coal", amount: 5 },
        ],
        outputs: [{ resource: "bread", amount: 10 }],
        days: 2,
      },
    ],
  },
  bank: {
    name: "Bank",
    icon: "🏦",
    description: "Too big to fail",
    cost: 100,
    color: "#FFD700",
    category: "utility",
    productionMethods: [
      {
        name: "Deposit Coins",
        inputs: [{ resource: "coins", amount: 100, nodes: 4 }],
        outputs: [{ resource: "money", amount: 500 }],
        days: 10,
      },
    ],
  },
  foraging: {
    name: "Foraging Camp",
    icon: "🍇",
    description: "Gathers wild resources",
    cost: 0,
    color: "#32CD32",
    category: "production",
    productionMethods: [
      {
        name: "Gather Berries",
        inputs: [],
        outputs: [{ resource: "berries", amount: 10 }],
        days: 1,
      },
    ],
  },
  fishing: {
    name: "Fishing Dock",
    icon: "🎣",
    description: "Catches fish from the water",
    cost: 0,
    color: "#1E90FF",
    category: "production",
    productionMethods: [
      {
        name: "Handing Nets",
        inputs: [],
        outputs: [{ resource: "fish", amount: 5 }],
        days: 1,
      },
      {
        name: "Spearing Fish",
        inputs: [{ resource: "tools", amount: 2 }],
        outputs: [{ resource: "fish", amount: 20, nodes: 2 }],
        days: 1,
      },
    ],
  },
  hunting: {
    name: "Hunting Lodge",
    icon: "🏹",
    description: "Hunts wild animals for resources",
    cost: 0,
    color: "#8B4513",
    category: "production",
    productionMethods: [
      {
        name: "Hunting",
        inputs: [{ resource: "tools", amount: 2 }],
        outputs: [{ resource: "meat", amount: 5 }],
        days: 1,
      },
    ],
  },
  granary: {
    name: "Granary",
    icon: "🫙",
    description: "Stores food for future use",
    cost: 0,
    color: "#FFD700",
    category: "storage",
    productionMethods: [
      {
        name: "Storing Wheat",
        inputs: [{ resource: "wheat", amount: 1000, nodes: 4 }],
        outputs: [{ resource: "food", amount: 1 }],
        days: 1,
      },
      {
        name: "Storing Bread",
        inputs: [{ resource: "bread", amount: 200, nodes: 4 }],
        outputs: [{ resource: "food", amount: 1 }],
        days: 1,
      },
    ],
  },
  smelter: {
    name: "Smelter",
    icon: "🏭",
    description: "Smelts ores into metal",
    cost: 0,
    color: "#B22222",
    category: "refining",
    productionMethods: [
      {
        name: "Bronze",
        inputs: [
          { resource: "copper", amount: 10 },
          { resource: "tin", amount: 10 },
        ],
        outputs: [{ resource: "bronze", amount: 10 }],
        days: 2,
      },
      {
        name: "Steel",
        inputs: [
          { resource: "iron", amount: 20 },
          { resource: "coal", amount: 40, nodes: 2 },
        ],
        outputs: [{ resource: "steel", amount: 10 }],
        days: 4,
      },
    ],
  },
  toolsmith: {
    name: "Toolsmith",
    icon: "🛠️",
    description: "Crafts tools for various purposes",
    cost: 0,
    color: "#8B4513",
    category: "refining",
    productionMethods: [
      {
        name: "Stone Tools",
        inputs: [
          { resource: "wood", amount: 10 },
          { resource: "stone", amount: 5 },
        ],
        outputs: [{ resource: "tools", amount: 1 }],
        days: 4,
      },
      {
        name: "Bronze Tools",
        inputs: [
          { resource: "wood", amount: 10 },
          { resource: "bronze", amount: 5 },
        ],
        outputs: [{ resource: "tools", amount: 2 }],
        days: 3,
      },
      {
        name: "Iron Tools",
        inputs: [
          { resource: "wood", amount: 10 },
          { resource: "iron", amount: 5 },
        ],
        outputs: [{ resource: "tools", amount: 4, nodes: 2 }],
        days: 2,
      },
      {
        name: "Steel Tools",
        inputs: [
          { resource: "wood", amount: 10 },
          { resource: "steel", amount: 5 },
        ],
        outputs: [{ resource: "tools", amount: 8, nodes: 2 }],
        days: 1,
      },
    ],
  },
  mine: {
    name: "Mine",
    icon: "⛏️",
    description: "Extracts minerals from the earth",
    cost: 0,
    color: "#708090",
    category: "production",
    productionMethods: [
      {
        name: "Mining Copper",
        inputs: [{ resource: "tools", amount: 1 }],
        outputs: [{ resource: "copper", amount: 10 }],
        days: 2,
      },
      {
        name: "Mining Tin",
        inputs: [{ resource: "tools", amount: 1 }],
        outputs: [{ resource: "tin", amount: 10 }],
        days: 2,
      },
      {
        name: "Mining Iron",
        inputs: [{ resource: "tools", amount: 2 }],
        outputs: [{ resource: "iron", amount: 10 }],
        days: 2,
      },
      {
        name: "Mining Coal",
        inputs: [{ resource: "tools", amount: 4 }],
        outputs: [{ resource: "coal", amount: 50, nodes: 2 }],
        days: 2,
      },
    ],
  },
  mint: {
    name: "Mint",
    icon: "🏦",
    description: "Produces coins from metal",
    cost: 0,
    color: "#FFD700",
    category: "refining",
    productionMethods: [
      {
        name: "Copper Coins",
        inputs: [{ resource: "copper", amount: 1 }],
        outputs: [{ resource: "coins", amount: 10 }],
        days: 1,
      },
    ],
  },
} as const satisfies Record<string, BuildingClass>;

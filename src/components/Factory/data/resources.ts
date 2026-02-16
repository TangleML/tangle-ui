import { type Resource, type ResourceType } from "../types/resources";

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  any: "#FFFFFF",
  money: "#FFD700",
  knowledge: "#6A5ACD",
  food: "#ADFF2F",
  water: "#1E90FF",
  coins: "#DAA520",
  wood: "#8B4513",
  stone: "#708090",
  wheat: "#F4A460",
  planks: "#D2691E",
  paper: "#FFFFE0",
  books: "#FFD700",
  livestock: "#A52A2A",
  leather: "#DEB887",
  meat: "#FF6347",
  coal: "#36454F",
  flour: "#FFF8DC",
  bread: "#F5DEB3",
  berries: "#FF69B4",
  fish: "#1E90FF",
  tools: "#808080",
  tin: "#B0C4DE",
  copper: "#B87333",
  bronze: "#CD7F32",
  iron: "#A9A9A9",
  steel: "#C0C0C0",
};

export const RESOURCE_VALUES: Record<ResourceType, number> = {
  any: 1,
  money: 0,
  knowledge: 0,
  food: 0,
  water: 0,
  coins: 1,
  wood: 2,
  stone: 3,
  wheat: 1,
  planks: 7,
  paper: 1,
  books: 65,
  livestock: 50,
  leather: 10,
  meat: 8,
  coal: 2,
  flour: 3,
  bread: 6,
  berries: 2,
  fish: 4,
  tools: 25,
  tin: 4,
  copper: 4,
  bronze: 8,
  iron: 16,
  steel: 64,
};

export const RESOURCES = {
  any: {
    name: "Any",
    description: "It could be anything!",
    color: RESOURCE_COLORS.any,
    value: RESOURCE_VALUES.any,
    icon: "❓",
  },
  money: {
    name: "Money",
    description: "You need money to pay for things!",
    color: RESOURCE_COLORS.money,
    value: RESOURCE_VALUES.money,
    icon: "💰",
    global: true,
  },
  knowledge: {
    name: "Knowledge",
    description: "Knowledge is the quest for a brighter future.",
    color: RESOURCE_COLORS.knowledge,
    value: RESOURCE_VALUES.knowledge,
    icon: "🧠",
    global: true,
  },
  food: {
    name: "Food",
    description: "Food is essential for survival and growth.",
    color: RESOURCE_COLORS.food,
    value: RESOURCE_VALUES.food,
    foodValue: 1,
    icon: "🍎",
    global: true,
  },
  water: {
    name: "Water",
    description: "Water is essential for life and agriculture.",
    color: RESOURCE_COLORS.water,
    value: RESOURCE_VALUES.water,
    icon: "💧",
  },
  coins: {
    name: "Coins",
    description: "Coins are a form of currency used for trade.",
    color: RESOURCE_COLORS.coins,
    value: RESOURCE_VALUES.coins,
    icon: "🪙",
  },
  wood: {
    name: "Wood",
    description: "Wood is a basic building material.",
    color: RESOURCE_COLORS.wood,
    value: RESOURCE_VALUES.wood,
    icon: "🪵",
  },
  stone: {
    name: "Stone",
    description: "Stone is a durable building material.",
    color: RESOURCE_COLORS.stone,
    value: RESOURCE_VALUES.stone,
    icon: "🪨",
  },
  wheat: {
    name: "Wheat",
    description: "Wheat is a staple crop used for food production.",
    color: RESOURCE_COLORS.wheat,
    value: RESOURCE_VALUES.wheat,
    foodValue: 1,
    icon: "🌾",
  },
  planks: {
    name: "Planks",
    description: "Planks are processed wood used for construction.",
    color: RESOURCE_COLORS.planks,
    value: RESOURCE_VALUES.planks,
    icon: "🪚",
  },
  paper: {
    name: "Paper",
    description: "Paper is used for writing and record-keeping.",
    color: RESOURCE_COLORS.paper,
    value: RESOURCE_VALUES.paper,
    icon: "📄",
  },
  books: {
    name: "Books",
    description: "Books contain knowledge and information.",
    color: RESOURCE_COLORS.books,
    value: RESOURCE_VALUES.books,
    icon: "📚",
  },
  livestock: {
    name: "Livestock",
    description: "Livestock are animals raised for food and materials.",
    color: RESOURCE_COLORS.livestock,
    value: RESOURCE_VALUES.livestock,
    icon: "🐄",
  },
  leather: {
    name: "Leather",
    description: "Leather is a durable material made from animal hides.",
    color: RESOURCE_COLORS.leather,
    icon: "👞",
    value: RESOURCE_VALUES.leather,
  },
  meat: {
    name: "Meat",
    description: "Meat is a source of food and nutrition.",
    color: RESOURCE_COLORS.meat,
    value: RESOURCE_VALUES.meat,
    foodValue: 5,
    icon: "🍖",
  },
  coal: {
    name: "Coal",
    description: "Coal is a fossil fuel used for energy production.",
    color: RESOURCE_COLORS.coal,
    value: RESOURCE_VALUES.coal,
    icon: "♠️",
  },
  flour: {
    name: "Flour",
    description:
      "Flour is a powder made from grinding grains, used for baking.",
    color: RESOURCE_COLORS.flour,
    value: RESOURCE_VALUES.flour,
    icon: "🥖",
  },
  bread: {
    name: "Bread",
    description: "Bread is a staple food made from flour and water.",
    color: RESOURCE_COLORS.bread,
    value: RESOURCE_VALUES.bread,
    foodValue: 10,
    icon: "🍞",
  },
  berries: {
    name: "Berries",
    description: "Berries are small, juicy fruits that grow on bushes.",
    color: RESOURCE_COLORS.berries,
    value: RESOURCE_VALUES.berries,
    foodValue: 1,
    icon: "🍓",
  },
  fish: {
    name: "Fish",
    description: "Fish are aquatic animals that can be caught for food.",
    color: RESOURCE_COLORS.fish,
    value: RESOURCE_VALUES.fish,
    foodValue: 2,
    icon: "🐟",
  },
  tools: {
    name: "Tools",
    description: "Tools are used to perform tasks more efficiently.",
    color: RESOURCE_COLORS.tools,
    value: RESOURCE_VALUES.tools,
    icon: "🛠️",
  },
  tin: {
    name: "Tin",
    description: "Tin is a metal used for making alloys like bronze.",
    color: RESOURCE_COLORS.tin,
    value: RESOURCE_VALUES.tin,
    icon: "🔩",
  },
  copper: {
    name: "Copper",
    description:
      "Copper is a versatile metal used in construction and electronics.",
    color: RESOURCE_COLORS.copper,
    value: RESOURCE_VALUES.copper,
    icon: "🪙",
  },
  bronze: {
    name: "Bronze",
    description:
      "Bronze is an alloy of copper and tin, used for tools and weapons.",
    color: RESOURCE_COLORS.bronze,
    value: RESOURCE_VALUES.bronze,
    icon: "⚔️",
  },
  iron: {
    name: "Iron",
    description:
      "Iron is a strong metal used for construction, tools, and machinery.",
    color: RESOURCE_COLORS.iron,
    value: RESOURCE_VALUES.iron,
    icon: "⛓️",
  },
  steel: {
    name: "Steel",
    description:
      "Steel is an alloy of iron and carbon, known for its strength and durability.",
    color: RESOURCE_COLORS.steel,
    value: RESOURCE_VALUES.steel,
    icon: "🏗️",
  },
} as const satisfies Record<ResourceType, Resource>;

// Extract global resource types dynamically
export type GlobalResourceType = {
  [K in keyof typeof RESOURCES]: (typeof RESOURCES)[K] extends { global: true }
    ? K
    : never;
}[keyof typeof RESOURCES];

export type GlobalResources = Record<GlobalResourceType, number>;

// Helper to check if a resource is global at runtime
export function isGlobalResource(
  resourceType: ResourceType,
): resourceType is GlobalResourceType {
  const resource = RESOURCES[resourceType];
  return (
    resource !== undefined && "global" in resource && resource.global === true
  );
}

// Get all global resource keys
export const GLOBAL_RESOURCE_KEYS = (
  Object.keys(RESOURCES) as ResourceType[]
).filter((key): key is GlobalResourceType => {
  const resource = RESOURCES[key];
  return (
    resource !== undefined && "global" in resource && resource.global === true
  );
});

export type FoodProducingResourceType = {
  [K in keyof typeof RESOURCES]: (typeof RESOURCES)[K] extends {
    foodValue: number;
  }
    ? K
    : never;
}[keyof typeof RESOURCES];

export function isFoodProducingResourceType(
  resourceType: ResourceType,
): resourceType is FoodProducingResourceType {
  const resource = RESOURCES[resourceType];
  return (
    resource !== undefined &&
    "foodValue" in resource &&
    typeof resource.foodValue === "number" &&
    resource.foodValue > 0
  );
}

export function getResourceTypeFoodValue(resourceType: ResourceType): number {
  if (!isFoodProducingResourceType(resourceType)) {
    return 0;
  }

  const resource = RESOURCES[resourceType];
  return resource.foodValue || 0;
}

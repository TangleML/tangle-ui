import type { Resource, ResourceType } from "../types/resources";

export const RESOURCE_COLORS: Record<ResourceType, string> = {
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
  knowledge: "#6A5ACD",
  coal: "#36454F",
  flour: "#FFF8DC",
  bread: "#F5DEB3",
  any: "#FFFFFF",
};

export const RESOURCES: Record<ResourceType, Resource> = {
  coins: {
    name: "coins",
    description: "Coins are a form of currency used for trade.",
    color: RESOURCE_COLORS.coins,
    icon: "💰",
  },
  wood: {
    name: "wood",
    description: "Wood is a basic building material.",
    color: RESOURCE_COLORS.wood,
    icon: "🪵",
  },
  stone: {
    name: "stone",
    description: "Stone is a durable building material.",
    color: RESOURCE_COLORS.stone,
    icon: "🪨",
  },
  wheat: {
    name: "wheat",
    description: "Wheat is a staple crop used for food production.",
    color: RESOURCE_COLORS.wheat,
    icon: "🌾",
  },
  planks: {
    name: "planks",
    description: "Planks are processed wood used for construction.",
    color: RESOURCE_COLORS.planks,
    icon: "🪚",
  },
  paper: {
    name: "paper",
    description: "Paper is used for writing and record-keeping.",
    color: RESOURCE_COLORS.paper,
    icon: "📄",
  },
  books: {
    name: "books",
    description: "Books contain knowledge and information.",
    color: RESOURCE_COLORS.books,
    icon: "📚",
  },
  livestock: {
    name: "livestock",
    description: "Livestock are animals raised for food and materials.",
    color: RESOURCE_COLORS.livestock,
    icon: "🐄",
  },
  leather: {
    name: "leather",
    description: "Leather is a durable material made from animal hides.",
    color: RESOURCE_COLORS.leather,
    icon: "👞",
  },
  meat: {
    name: "meat",
    description: "Meat is a source of food and nutrition.",
    color: RESOURCE_COLORS.meat,
    icon: "🍖",
  },
  knowledge: {
    name: "knowledge",
    description: "Knowledge represents the understanding and information.",
    color: RESOURCE_COLORS.knowledge,
    icon: "🧠",
  },
  coal: {
    name: "coal",
    description: "Coal is a fossil fuel used for energy production.",
    color: RESOURCE_COLORS.coal,
    icon: "🪨",
  },
  flour: {
    name: "flour",
    description:
      "Flour is a powder made from grinding grains, used for baking.",
    color: RESOURCE_COLORS.flour,
    icon: "🥖",
  },
  bread: {
    name: "bread",
    description: "Bread is a staple food made from flour and water.",
    color: RESOURCE_COLORS.bread,
    icon: "🍞",
  },
  any: {
    name: "any",
    description: "Represents any type of resource.",
    color: RESOURCE_COLORS.any,
    icon: "❓",
  },
};

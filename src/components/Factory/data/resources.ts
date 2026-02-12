import type { Resource, ResourceType } from "../types/resources";

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  wood: "#8B4513",
  stone: "#708090",
  wheat: "#F4A460",
  planks: "#D2691E",
  any: "#FFFFFF",
};

export const RESOURCES: Record<ResourceType, Resource> = {
  wood: { type: "wood", color: RESOURCE_COLORS.wood },
  stone: { type: "stone", color: RESOURCE_COLORS.stone },
  wheat: { type: "wheat", color: RESOURCE_COLORS.wheat },
  planks: { type: "planks", color: RESOURCE_COLORS.planks },
  any: { type: "any", color: RESOURCE_COLORS.any },
};

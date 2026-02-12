export type ResourceType =
  | "wood"
  | "stone"
  | "wheat"
  | "planks"
  | "paper"
  | "books"
  | "livestock"
  | "leather"
  | "meat"
  | "knowledge"
  | "coins"
  | "coal"
  | "flour"
  | "bread"
  | "any";

export interface Resource {
  name: string;
  description: string;
  color: string;
  icon: string;
  quantity?: number;
}

const RESOURCE_TYPES = [
  "wood",
  "stone",
  "wheat",
  "planks",
  "paper",
  "books",
  "livestock",
  "leather",
  "meat",
  "knowledge",
  "coins",
  "coal",
  "flour",
  "bread",
  "any",
] as const satisfies readonly ResourceType[];

export function isResourceType(value: any): value is ResourceType {
  return RESOURCE_TYPES.includes(value as ResourceType);
}

export function isResourceData(data: any): data is Resource {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.color === "string" &&
    typeof data.name === "string" &&
    typeof data.description === "string" &&
    typeof data.icon === "string"
  );
}

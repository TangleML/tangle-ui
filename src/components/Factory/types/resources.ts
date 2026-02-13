export interface Resource {
  name: string;
  description: string;
  color: string;
  icon: string;
  value: number;
  global?: boolean;
}

const RESOURCE_TYPES = [
  "money",
  "knowledge",
  "wood",
  "stone",
  "wheat",
  "planks",
  "paper",
  "books",
  "livestock",
  "leather",
  "meat",
  "coins",
  "coal",
  "flour",
  "bread",
  "any",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

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
    typeof data.icon === "string" &&
    typeof data.value === "number" &&
    (data.global === undefined || typeof data.global === "boolean")
  );
}

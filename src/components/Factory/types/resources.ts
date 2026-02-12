export type ResourceType = "wood" | "stone" | "wheat" | "planks" | "any";

export interface Resource {
  type: ResourceType;
  quantity?: number;
  color: string;
}

const RESOURCE_TYPES = [
  "wood",
  "stone",
  "wheat",
  "planks",
  "any",
] as const satisfies readonly ResourceType[];

export function isResourceType(value: any): value is ResourceType {
  return RESOURCE_TYPES.includes(value as ResourceType);
}

export function isResourceData(data: any): data is Resource {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.type === "string" &&
    typeof data.color === "string"
  );
}

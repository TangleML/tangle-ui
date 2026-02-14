export type BuildingType =
  | "woodcutter"
  | "quarry"
  | "farm"
  | "sawmill"
  | "marketplace";

export interface Building {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost?: number;
  color: string;
}

export function isBuildingData(data: any): data is Building {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.id === "string" &&
    typeof data.name === "string" &&
    typeof data.icon === "string" &&
    typeof data.description === "string" &&
    typeof data.color === "string"
  );
}

import { isResourceType, type ResourceType } from "../types/resources";

export const extractResource = (
  string: string | null | undefined,
): ResourceType | null => {
  if (!string) return null;
  const match = string.match(/resource:([^-]+)/);
  if (!match) return null;

  const resource = match[1];

  if (!isResourceType(resource)) {
    console.error("Invalid resource type in string:", string);
    return null;
  }

  return resource;
};

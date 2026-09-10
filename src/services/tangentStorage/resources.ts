import type { HostResourceInput } from "@tangent/embed-react";

import { tangentDb } from "./db";
import type { TangentResource, TangentResourceInput } from "./types";

/**
 * Adds a resource to a project, deduping by `url`. Re-adding the same URL
 * updates the existing entry in place instead of creating a duplicate.
 */
export async function addResource(
  projectId: string,
  input: TangentResourceInput,
): Promise<TangentResource> {
  const existing = await tangentDb.resources
    .where("[projectId+url]")
    .equals([projectId, input.url])
    .first();

  if (existing) {
    const updated: TangentResource = {
      ...existing,
      type: input.type,
      name: input.name,
      description: input.description,
    };
    await tangentDb.resources.put(updated);
    return updated;
  }

  const resource: TangentResource = {
    id: crypto.randomUUID(),
    projectId,
    type: input.type,
    url: input.url,
    name: input.name,
    description: input.description,
    createdAt: Date.now(),
  };
  await tangentDb.resources.add(resource);
  return resource;
}

export function listProjectResources(
  projectId: string,
): Promise<TangentResource[]> {
  return tangentDb.resources
    .where("projectId")
    .equals(projectId)
    .sortBy("createdAt");
}

export async function removeResource(id: string): Promise<void> {
  await tangentDb.resources.delete(id);
}

/** Builds a session-scoped memory resource input for the embed API. */
export function toMemoryResourceInput(content: string): HostResourceInput {
  return { kind: "memory", scope: "session", content };
}

/** Maps a stored resource to the embed API's host-resource input shape. */
export function toHostResourceInput(
  resource: TangentResource,
): HostResourceInput {
  return {
    kind: "host",
    name: resource.name,
    uri: resource.url,
    meta: {
      type: resource.type,
      url: resource.url,
      name: resource.name,
      description: resource.description,
    },
  };
}

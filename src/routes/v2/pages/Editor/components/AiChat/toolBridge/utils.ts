/**
 * Shared deps + helpers for the per-domain bridge handler modules.
 *
 * `BridgeDeps` is the closure-shape every handler factory receives.
 * `requireSpec` / `requireBackendUrl` throw model-friendly errors when
 * the dep is missing so the worker surfaces a clear message instead of
 * a generic null dereference. `errorMessage` normalizes unknown
 * exceptions into a string for the `error` field of bridge results.
 *
 * `computeNextPosition` walks the spec's positioned entities and picks
 * a spot just to the right of the rightmost one so newly-added tasks /
 * IO don't pile up at the origin.
 */
import type { QueryClient } from "@tanstack/react-query";

import type { ComponentSpec } from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

const DEFAULT_POSITION = { x: 250, y: 250 };
const POSITION_OFFSET = 200;

export interface BridgeDeps {
  getSpec: () => ComponentSpec | null;
  getActiveSubgraphPath: () => string[];
  undo: UndoGroupable;
  getBackendUrl?: () => string;
  getAuthToken?: () => string | undefined;
  queryClient?: QueryClient;
}

interface EntityWithAnnotations {
  annotations: { get(key: string): unknown };
}

export function requireSpec(deps: BridgeDeps): ComponentSpec {
  const spec = deps.getSpec();
  if (!spec) {
    throw new Error(
      "No pipeline is currently open — open a pipeline before asking the agent to edit it.",
    );
  }
  return spec;
}

export function requireBackendUrl(deps: BridgeDeps): string {
  const url = deps.getBackendUrl?.();
  if (!url) {
    throw new Error(
      "Backend is not configured — agent cannot reach the Tangle backend.",
    );
  }
  return url;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}

export function computeNextPosition(spec: ComponentSpec): {
  x: number;
  y: number;
} {
  const allEntities: EntityWithAnnotations[] = [
    ...spec.tasks,
    ...spec.inputs,
    ...spec.outputs,
  ];
  if (allEntities.length === 0) return DEFAULT_POSITION;

  let maxX = 0;
  let maxY = 0;
  for (const entity of allEntities) {
    const pos = entity.annotations.get(EDITOR_POSITION_ANNOTATION) as
      | { x: number; y: number }
      | undefined;
    if (pos) {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
  }
  return { x: maxX + POSITION_OFFSET, y: maxY };
}

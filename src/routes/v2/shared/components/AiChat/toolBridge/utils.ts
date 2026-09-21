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

import type { ValidationResult } from "@/agent/toolBridgeApi";
import type { ComponentSpec } from "@/models/componentSpec";
import { getFlexNodes } from "@/models/componentSpec/queries/flexNodes";
import { locateEntity } from "@/models/componentSpec/queries/locateEntity";
import {
  collectValidationIssues,
  ROOT_PATH_ID,
} from "@/models/componentSpec/validation/collectIssues";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

const DEFAULT_POSITION = { x: 250, y: 250 };
const POSITION_OFFSET = 200;
const ANCHOR_GAP = 140;

export interface BridgeDeps {
  getSpec: () => ComponentSpec | null;
  getActiveSubgraphPath: () => string[];
  getActiveSubgraphTaskId: () => string | undefined;
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

/**
 * The `"root"` segment that `collectValidationIssues` prefixes is dropped on the
 * way out: `activeSubgraphPath` — the only other path the model ever sees — is
 * the bare chain of subgraph task names, and a model correlating "where is this
 * issue" against "where am I" cannot match the two otherwise, or tries to
 * descend into a subgraph literally named "root".
 */
export function toValidationResult(spec: ComponentSpec): ValidationResult {
  const issues = collectValidationIssues(spec);
  return {
    valid: issues.length === 0,
    issueCount: issues.length,
    issues: issues.map((i) => ({
      type: i.type,
      severity: i.severity,
      message: i.message,
      entityId: i.entityId,
      entityName: i.entityName,
      issueCode: i.issueCode,
      subgraphPath:
        i.subgraphPath[0] === ROOT_PATH_ID
          ? i.subgraphPath.slice(1)
          : i.subgraphPath,
    })),
  };
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
  const stickyNotes = getFlexNodes(spec);
  if (allEntities.length === 0 && stickyNotes.length === 0) {
    return DEFAULT_POSITION;
  }

  let maxX = 0;
  let maxY = 0;
  for (const entity of allEntities) {
    const pos = entity.annotations.get(EDITOR_POSITION_ANNOTATION) as
      { x: number; y: number } | undefined;
    if (pos) {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
  }
  for (const note of stickyNotes) {
    maxX = Math.max(maxX, note.position.x + note.size.width);
    maxY = Math.max(maxY, note.position.y);
  }
  return { x: maxX + POSITION_OFFSET, y: maxY };
}

export interface NoteAnchor {
  spec: ComponentSpec;
  position: { x: number; y: number };
}

/**
 * Places a sticky note above the entity it annotates, in whichever graph that
 * entity lives in. The model cannot read entity coordinates, so it names what
 * the note is about and both the position and the destination graph are derived
 * from that — a note annotating a task belongs beside that task, not wherever
 * the user happens to be looking.
 */
export function resolveNoteAnchor(
  root: ComponentSpec,
  anchorEntityId: string,
): (NoteAnchor & { ok: true }) | { ok: false; error: string } {
  const location = locateEntity(root, anchorEntityId);
  if (!location || location.kind === "binding") {
    return {
      ok: false,
      error: `Nothing was added — no task, input or output with $id "${anchorEntityId}" exists to anchor the note to. Pass a position instead, or omit both to place the note beside the rest of the graph.`,
    };
  }

  const pos = location.entity.annotations.get(EDITOR_POSITION_ANNOTATION) as
    { x: number; y: number } | undefined;
  return {
    ok: true,
    spec: location.spec,
    position: pos
      ? { x: pos.x, y: pos.y - ANCHOR_GAP }
      : computeNextPosition(location.spec),
  };
}

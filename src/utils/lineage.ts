import { z } from "zod";

import type { ComponentSpec } from "./componentSpec";

/**
 * Stable lineage of a component instance: where it originally came from,
 * captured the moment it first enters a pipeline (before any local edit).
 *
 * Tangle components are content-addressed, so a component's `digest` changes
 * on every edit and cannot identify "the same component across versions". The
 * lineage `originId` is a stable identifier — the source `url` for
 * published/library components, otherwise the original `digest` — that
 * survives edits, letting us trace and reconcile every instance descended from
 * a single origin.
 *
 * Lineage is stored as a task-level annotation (`LINEAGE_ORIGIN_ANNOTATION`),
 * NOT inside the component spec text, so it never perturbs the component digest
 * and is preserved automatically when a task's `componentRef` is swapped.
 */
export interface ComponentLineage {
  /** Stable origin identity: source `url` if available, else the original digest. */
  originId: string;
  /** The origin component's digest at first entry (pre-edit), for display/diff. */
  originDigest?: string;
  /** Human-readable origin name, for display. */
  originName?: string;
}

export const componentLineageSchema = z.object({
  originId: z.string().min(1),
  originDigest: z.string().optional(),
  originName: z.string().optional(),
});

/**
 * Task-level annotation key holding a task's {@link ComponentLineage}. Defined
 * here (rather than in the heavier `@/utils/annotations`) so the model layer can
 * read it without pulling app/component modules into its import graph.
 */
export const LINEAGE_ORIGIN_ANNOTATION = "tangleml.com/lineage/origin";

/**
 * Key used to embed lineage inside a *published* component's spec metadata
 * (the cross-pipeline discovery extension). Dot-free on purpose: Elasticsearch
 * splits dotted field keys into nested objects, which would break filtering.
 */
export const EMBEDDED_LINEAGE_KEY = "lineage_origin";

type ReferenceLike = {
  url?: string;
  digest?: string;
  name?: string;
};

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return undefined;
  }
}

/**
 * The stable origin identifier for a component reference: its source `url`
 * (published/library) if present, otherwise its content `digest`.
 */
export function originIdOf(ref: ReferenceLike): string | undefined {
  return ref.url ?? ref.digest ?? undefined;
}

/**
 * Build a lineage record from a component reference at the moment it enters a
 * pipeline. Returns `undefined` when the reference has no stable identity yet.
 */
export function makeLineage(ref: ReferenceLike): ComponentLineage | undefined {
  const originId = originIdOf(ref);
  if (!originId) return undefined;
  return {
    originId,
    originDigest: ref.digest,
    originName: ref.name,
  };
}

/**
 * Read a lineage previously embedded in a (published) component spec's metadata
 * annotations, if present and valid.
 */
export function embeddedLineageOf(
  spec: ComponentSpec | undefined,
): ComponentLineage | undefined {
  const raw = spec?.metadata?.annotations?.[EMBEDDED_LINEAGE_KEY];
  if (raw == null) return undefined;
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  const result = componentLineageSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * Resolve the lineage to stamp on a task created from `ref`: prefer a lineage
 * already embedded in the component spec (a published origin), otherwise derive
 * one from the reference's own identity.
 */
export function resolveLineageForRef(
  ref: ReferenceLike & { spec?: ComponentSpec },
): ComponentLineage | undefined {
  return embeddedLineageOf(ref.spec) ?? makeLineage(ref);
}

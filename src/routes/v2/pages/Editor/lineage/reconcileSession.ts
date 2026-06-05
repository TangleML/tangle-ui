import { z } from "zod";

/**
 * A cross-pipeline reconcile session. Created when the user starts reconciling a
 * component across pipelines; referenced by id from the `?reconcile=<id>` /
 * `?reconcileOverview=<id>` URL params as they navigate between pipelines.
 *
 * Persisted in localStorage so it survives the navigation between pipelines (and
 * a refresh). It is self-contained — it carries the edited component text — so a
 * reconcile can proceed even if the content-addressed store has evicted it.
 * Sessions are swept on editor mount once older than the TTL.
 */
const STORAGE_PREFIX = "reconcile:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

const worklistItemSchema = z.object({
  storageKey: z.string(),
  status: z.enum(["pending", "skipped"]),
});

const reconcileSessionSchema = z.object({
  sessionId: z.string(),
  /** Lineage origin being reconciled (the locator). */
  originId: z.string(),
  /** Digest of the edited (target) version every instance is reconciled to. */
  targetDigest: z.string(),
  /** Self-contained edited component YAML, so the session needs no store lookup. */
  targetComponentText: z.string(),
  targetName: z.string(),
  /** Where to return when reconciling ends (origin editor + reconcile overview). */
  returnTo: z.string(),
  worklist: z.array(worklistItemSchema),
  createdAt: z.number(),
});

export type ReconcileSession = z.infer<typeof reconcileSessionSchema>;

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const keyFor = (sessionId: string) => STORAGE_PREFIX + sessionId;

export function createReconcileSession(
  input: Omit<ReconcileSession, "sessionId" | "createdAt">,
): ReconcileSession {
  const session: ReconcileSession = {
    ...input,
    sessionId: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  storage()?.setItem(keyFor(session.sessionId), JSON.stringify(session));
  return session;
}

export function getReconcileSession(
  sessionId: string,
): ReconcileSession | undefined {
  const raw = storage()?.getItem(keyFor(sessionId));
  if (!raw) return undefined;
  try {
    const result = reconcileSessionSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function updateReconcileSession(
  sessionId: string,
  patch: Partial<Omit<ReconcileSession, "sessionId">>,
): ReconcileSession | undefined {
  const existing = getReconcileSession(sessionId);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  storage()?.setItem(keyFor(sessionId), JSON.stringify(updated));
  return updated;
}

export function deleteReconcileSession(sessionId: string): void {
  storage()?.removeItem(keyFor(sessionId));
}

/** Remove orphaned sessions older than `maxAgeMs`. Called on editor mount. */
export function sweepExpiredReconcileSessions(
  maxAgeMs: number = DEFAULT_TTL_MS,
): void {
  const s = storage();
  if (!s) return;
  const now = Date.now();
  const toRemove: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    const session = getReconcileSession(key.slice(STORAGE_PREFIX.length));
    if (!session || now - session.createdAt > maxAgeMs) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) s.removeItem(key);
}

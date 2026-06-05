import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createReconcileSession,
  deleteReconcileSession,
  getReconcileSession,
  type ReconcileSession,
  sweepExpiredReconcileSessions,
  updateReconcileSession,
} from "./reconcileSession";

function fakeLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const baseInput: Omit<ReconcileSession, "sessionId" | "createdAt"> = {
  originId: "https://x/train.yaml",
  targetDigest: "edited-digest",
  targetComponentText: "name: Train\n",
  targetName: "Train",
  returnTo: "/editor-v2/Origin?reconcileOverview=X",
  worklist: [{ storageKey: "Pipeline A", status: "pending" }],
};

describe("reconcileSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", fakeLocalStorage());
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-1" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("creates, reads, updates, and deletes a session", () => {
    const created = createReconcileSession(baseInput);
    expect(created.sessionId).toBe("uuid-1");
    expect(getReconcileSession("uuid-1")).toMatchObject(baseInput);

    updateReconcileSession("uuid-1", {
      worklist: [{ storageKey: "Pipeline A", status: "skipped" }],
    });
    expect(getReconcileSession("uuid-1")?.worklist[0].status).toBe("skipped");

    deleteReconcileSession("uuid-1");
    expect(getReconcileSession("uuid-1")).toBeUndefined();
  });

  it("returns undefined for missing or malformed sessions", () => {
    expect(getReconcileSession("nope")).toBeUndefined();
    localStorage.setItem("reconcile:bad", "{not json");
    expect(getReconcileSession("bad")).toBeUndefined();
  });

  it("sweeps sessions older than the max age, keeping fresh ones", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    createReconcileSession(baseInput);

    // Not expired yet.
    sweepExpiredReconcileSessions(1000);
    expect(getReconcileSession("uuid-1")).toBeDefined();

    // Advance past the TTL.
    vi.setSystemTime(now + 5000);
    sweepExpiredReconcileSessions(1000);
    expect(getReconcileSession("uuid-1")).toBeUndefined();
  });
});

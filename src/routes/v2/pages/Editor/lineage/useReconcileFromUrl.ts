import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import { reconcileUIModeStore } from "@/routes/v2/shared/hooks/useReconcileUIMode";

import { reconcileModeStore } from "./reconcileModeStore";
import {
  getReconcileSession,
  sweepExpiredReconcileSessions,
} from "./reconcileSession";

/**
 * Drives reconcile mode from the URL. When the editor loads a pipeline with
 * `?reconcile=<sessionId>`, the matching session is loaded and reconcile mode is
 * entered; clearing the param (or an unknown/expired session) exits it. Orphaned
 * sessions are swept once on mount.
 */
export function useReconcileFromUrl(): void {
  const search = useSearch({ strict: false });
  const sessionId =
    "reconcile" in search && typeof search.reconcile === "string"
      ? search.reconcile
      : undefined;

  useEffect(() => {
    sweepExpiredReconcileSessions();
  }, []);

  useEffect(() => {
    const session = sessionId ? getReconcileSession(sessionId) : undefined;
    if (session) {
      reconcileModeStore.enter(session);
      reconcileUIModeStore.setActive(true);
    } else {
      reconcileModeStore.exit();
    }
    return () => {
      reconcileModeStore.exit();
      reconcileUIModeStore.setActive(false);
    };
  }, [sessionId]);
}

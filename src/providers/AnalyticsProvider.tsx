import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { ExistingFlags } from "@/flags";
import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { userQueryOptions } from "@/hooks/useUserDetails";

// ─── Private session & dispatch helpers ──────────────────────────────────────

const SESSION_KEY = "tangle_tab_session_id";

async function getUserHash(userId: string): Promise<string> {
  const data = new TextEncoder().encode(userId);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

async function getOrCreateSessionId(userId?: string): Promise<string> {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const uuid = crypto.randomUUID();
  const hash = userId ? await getUserHash(userId) : undefined;
  const id = hash ? `${hash}:${uuid}` : uuid;
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function dispatchTrack(
  sessionId: string,
  actionType: string,
  metadata?: Record<string, unknown>,
): void {
  window.dispatchEvent(
    new CustomEvent("tangle.analytics.track", {
      detail: {
        actionType,
        metadata,
        sessionId,
        route: window.location.pathname,
        appVersion: import.meta.env.VITE_GIT_COMMIT as string | undefined,
        environment: import.meta.env.VITE_TANGLE_ENV as string | undefined,
      },
    }),
  );
}

// ─── Context & Provider ───────────────────────────────────────────────────────

type TrackFn = (actionType: string, metadata?: Record<string, unknown>) => void;

interface AnalyticsContextValue {
  track: TrackFn;
}

const AnalyticsContext =
  createRequiredContext<AnalyticsContextValue>("AnalyticsContext");

/**
 * Provides analytics tracking to the component tree.
 *
 * On mount, fires a `session.tab.start` event with the current feature flags
 * once the user query resolves. Each `track` call awaits
 * `queryClient.ensureQueryData` for the current user before dispatching —
 * returning the cached value immediately after the first fetch, or waiting for
 * the in-flight request if it hasn't resolved yet. The session ID is created
 * lazily on the first dispatched event and reused for the lifetime of the
 * browser tab.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionIdPromise = useMemo(
    () =>
      queryClient.ensureQueryData(userQueryOptions).then((user) => {
        const userId = user.id !== "Unknown" ? user.id : undefined;
        return getOrCreateSessionId(userId);
      }),
    [queryClient],
  );

  const track = useCallback<TrackFn>(
    (actionType, metadata) => {
      void sessionIdPromise.then((sessionId) => {
        dispatchTrack(sessionId, actionType, metadata);
      });
    },
    [sessionIdPromise],
  );

  useEffect(() => {
    // sessionStorage persists across refreshes within the same tab. If the key
    // already exists this is a page reload, not a new tab session — skip.
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const flags = Object.fromEntries(
      Object.keys(ExistingFlags).map((key) => [
        key,
        isFlagEnabled(key as keyof typeof ExistingFlags),
      ]),
    );
    void sessionIdPromise.then((sessionId) => {
      dispatchTrack(sessionId, "session.tab.start", { flags });
    });
  }, [sessionIdPromise]);

  return <AnalyticsContext value={{ track }}>{children}</AnalyticsContext>;
}

/** @public */
export function useAnalytics() {
  return useRequiredContext(AnalyticsContext);
}

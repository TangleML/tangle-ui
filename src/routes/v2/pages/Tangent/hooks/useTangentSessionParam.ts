import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  readTangentSessionParam,
  TANGENT_SESSION_SEARCH_PARAM,
} from "@/routes/tangentSearch";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * A link from the project page says which session to open, or asks for a new
 * one, because a session can only be started from inside Tangent's provider.
 *
 * The ask is acted on once and then taken out of the url: left there, a reload
 * would start a second session, and going back to a session the user has since
 * navigated away from would fight them for the selection.
 *
 * A new session has to wait for the store to be able to start one. This hook
 * runs in a child of the provider that wires the store up, and a child's effects
 * run before its parent's, so on the first commit the store has no way to reach
 * Tangent yet and `startSession` refuses. Consuming the ask there left the
 * caller on whichever session was already selected. Reading `canStartSession`
 * needs an observer for the flip to re-run this, which is what the workspace is.
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const handled = useRef(false);

  const asked = readTangentSessionParam(search);
  const canStartSession = store.canStartSession;

  useEffect(() => {
    if (!asked || handled.current) return;
    if (asked.kind === "new" && !canStartSession) return;
    handled.current = true;

    if (asked.kind === "new") {
      void store.startSession();
    } else {
      store.selectSession(asked.sessionId);
    }

    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next[TANGENT_SESSION_SEARCH_PARAM];
        return next;
      },
      replace: true,
    } as never);
  }, [asked, canStartSession, navigate, store]);
}

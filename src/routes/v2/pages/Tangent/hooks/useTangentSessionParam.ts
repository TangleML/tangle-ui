import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  readTangentSessionParam,
  TANGENT_SESSION_SEARCH_PARAM,
} from "@/routes/tangentSearch";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * A link asks for a session by url because one can only be started from inside
 * Tangent's provider. The ask is then taken back out: left there, a reload
 * would start a second session, and returning to a session the user has since
 * left would fight them for the selection.
 *
 * A new session waits for the store to be able to start one. This hook runs in
 * a child of the provider that wires the store up, and a child's effects run
 * first, so on the first commit `startSession` refuses. Reading
 * `canStartSession` needs an observer for the flip to re-run this, which is
 * what the workspace is.
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

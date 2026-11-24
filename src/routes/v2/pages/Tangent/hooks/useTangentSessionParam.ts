import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import {
  readTangentSessionParam,
  TANGENT_SESSION_SEARCH_PARAM,
} from "@/routes/tangentSearch";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * A link selects a session by url. The ask is then taken back out: left there,
 * returning to a session the user has since left would fight them for the
 * selection. A link asking for a new session is `usePrepareProjectArrival`'s.
 *
 * It's selected before the project's sessions load, so a good link doesn't
 * flash the latest session first. One that turns out not to be the project's
 * would leave the chat waiting forever, so it then falls back to the latest.
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const notify = useToastNotification();
  const { sessions, isLoaded } = useProjectSessions(store.projectId);
  const handled = useRef<TangentProjectStore | null>(null);
  const unconfirmedSessionId = useRef<string | null>(null);

  const asked = readTangentSessionParam(search);
  const sessionId = asked?.kind === "existing" ? asked.sessionId : undefined;

  useEffect(() => {
    if (!sessionId || handled.current === store) return;
    handled.current = store;
    unconfirmedSessionId.current = sessionId;

    store.selectSession(sessionId);

    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next[TANGENT_SESSION_SEARCH_PARAM];
        return next;
      },
      replace: true,
    } as never);
  }, [sessionId, navigate, store]);

  useEffect(() => {
    const linkedSessionId = unconfirmedSessionId.current;
    if (!linkedSessionId || !isLoaded) return;
    unconfirmedSessionId.current = null;

    const isProjectSession = sessions.some(
      (session) => session.sessionId === linkedSessionId,
    );
    if (isProjectSession || store.selectedSessionId !== linkedSessionId) {
      return;
    }
    store.clearSelectedSession();
    notify(
      "That session isn't available, so the latest one is open instead.",
      "warning",
    );
  }, [sessions, isLoaded, store, notify]);
}

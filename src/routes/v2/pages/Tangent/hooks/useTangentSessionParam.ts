import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import {
  readTangentSessionParam,
  TANGENT_SESSION_SEARCH_PARAM,
} from "@/routes/tangentSearch";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * A link selects a session by url. The ask is then taken back out: left there,
 * returning to a session the user has since left would fight them for the
 * selection. A link asking for a new session is `usePrepareProjectArrival`'s.
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const handled = useRef(false);

  const asked = readTangentSessionParam(search);
  const sessionId = asked?.kind === "existing" ? asked.sessionId : undefined;

  useEffect(() => {
    if (!sessionId || handled.current) return;
    handled.current = true;

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
}

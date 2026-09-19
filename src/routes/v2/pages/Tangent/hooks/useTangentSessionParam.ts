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
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const handled = useRef(false);

  const asked = readTangentSessionParam(search);

  useEffect(() => {
    if (!asked || handled.current) return;
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
  }, [asked, navigate, store]);
}

import { useNavigate, useSearch } from "@tanstack/react-router";
import { when } from "mobx";
import { useEffect } from "react";

import {
  readTangentSessionParam,
  TANGENT_SESSION_SEARCH_PARAM,
} from "@/routes/tangentSearch";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * A shared link must survive a reload, but should stop pointing at the old
 * chat once the user chooses a different one in the same project.
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  const asked = readTangentSessionParam(search);
  const sessionId = asked?.kind === "existing" ? asked.sessionId : undefined;

  useEffect(() => {
    if (!sessionId) return;

    store.selectSession(sessionId);

    return when(
      () => store.activeSessionId !== sessionId,
      () => {
        void navigate({
          to: ".",
          search: (previous: Record<string, unknown>) => {
            const next = { ...previous };
            delete next[TANGENT_SESSION_SEARCH_PARAM];
            return next;
          },
          replace: true,
        } as never);
      },
    );
  }, [sessionId, navigate, store]);
}

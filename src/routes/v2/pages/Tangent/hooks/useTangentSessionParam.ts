import { useNavigate, useSearch } from "@tanstack/react-router";
import { reaction, when } from "mobx";
import { useEffect } from "react";

import {
  readTangentSessionParam,
  withoutTangentMessageSearch,
  withoutTangentSessionSearch,
} from "@/routes/tangentSearch";
import {
  CHAT_TAB_VALUE,
  type TangentProjectStore,
} from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

/**
 * A shared link must survive a reload, but should stop pointing at the old
 * chat once the user chooses a different one in the same project.
 */
export function useTangentSessionParam(store: TangentProjectStore) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  const asked = readTangentSessionParam(search);
  const sessionId = asked?.kind === "existing" ? asked.sessionId : undefined;
  const message = asked?.kind === "existing" ? asked.message : undefined;
  const messageId = message?.messageId;
  const agentId = message?.agentId;

  useEffect(() => {
    if (!sessionId) return;

    store.selectSession(sessionId);

    return when(
      () => store.activeSessionId !== sessionId,
      () => {
        void navigate({
          to: ".",
          search: withoutTangentSessionSearch,
          replace: true,
        });
      },
    );
  }, [sessionId, navigate, store]);

  useEffect(() => {
    if (!sessionId || !messageId) return;
    const tab = agentId ?? CHAT_TAB_VALUE;
    if (!agentId || store.chatTabs.some(({ id }) => id === agentId)) {
      store.setChatActiveTab(tab);
    }
    // An unopened agent tab is selected by the embed after its roster arrives.
    return reaction(
      () => store.chatActiveTab,
      (activeTab) => {
        if (activeTab === tab || store.activeSessionId !== sessionId) return;
        void navigate({
          to: ".",
          search: withoutTangentMessageSearch,
          replace: true,
        });
      },
    );
  }, [sessionId, messageId, agentId, navigate, store]);

  return store.activeSessionId === sessionId ? message : undefined;
}

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { userQueryOptions } from "@/hooks/useUserDetails";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  readOpenTabs,
  rememberOpenTabs,
} from "@/routes/v2/pages/Tangent/workarea/openTabsStorage";

/**
 * Brings back the tabs this person had open in the project and keeps saving
 * them as they change. Tabs are saved per person, so nothing is restored or
 * saved until it's known who is here, and a file's tab is only restored
 * against the Tangent the project uses.
 */
export function useRememberOpenTabs(
  store: TangentProjectStore,
  tangentBaseUrl: string | null,
) {
  const { data: user } = useQuery(userQueryOptions);
  const userId = user?.id;

  useEffect(() => {
    store.setTangentBaseUrl(tangentBaseUrl);
  }, [store, tangentBaseUrl]);

  useEffect(() => {
    if (userId === undefined || !tangentBaseUrl) return;
    store.restoreOpenTabs(
      readOpenTabs({ userId, projectId: store.projectId }, tangentBaseUrl),
    );
    return rememberOpenTabs(store, userId);
  }, [store, userId, tangentBaseUrl]);
}

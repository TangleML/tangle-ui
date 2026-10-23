import type { QueryClient } from "@tanstack/react-query";
import { autorun, reaction } from "mobx";

import { promoteRemoteDraftQuery } from "@/routes/v2/pages/Editor/utils/promoteRemoteDraftQuery";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import {
  parseIdentity,
  remotePipelineIdentity,
} from "@/services/projects/resourceTarget";

/** Own drafts for every retained session, even while its editors are unmounted. */
export function observeWorkareaPipelineDrafts(
  store: TangentProjectStore,
  storage: PipelineStorageService,
  queryClient: QueryClient,
) {
  const retained = new Map<string, () => void>();
  const stop = autorun(() => {
    const draftTabs = new Set<string>();
    for (const [sessionId, { tabs }] of store.workareaBySession) {
      for (const tab of tabs) {
        if (tab.target.type !== "pipeline") continue;
        const { key, value } = parseIdentity(tab.target.identity);
        if (key !== "draft") continue;
        draftTabs.add(tab.id);
        if (retained.has(tab.id)) continue;
        const draft = storage.retainRemoteDraft(value);
        if (!draft) continue;
        let stopPromotion = () => {};
        retained.set(tab.id, () => {
          stopPromotion();
          draft.release();
        });
        stopPromotion = reaction(
          () => draft.file.remote,
          (remote) => {
            if (!remote) return;
            promoteRemoteDraftQuery(queryClient, draft.ref, {
              source: "remote",
              ...remote,
            });
            store.replaceWorkareaTabTarget(sessionId, tab.id, {
              type: "pipeline",
              identity: remotePipelineIdentity(remote.pipelineId),
            });
          },
          { fireImmediately: true },
        );
      }
    }
    for (const [tabId, release] of retained) {
      if (draftTabs.has(tabId)) continue;
      release();
      retained.delete(tabId);
    }
  });
  return () => {
    stop();
    for (const release of retained.values()) release();
    retained.clear();
  };
}

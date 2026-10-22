import { autorun, reaction } from "mobx";

import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";
import {
  parseIdentity,
  remotePipelineIdentity,
} from "@/services/projects/resourceTarget";

/** Every retained tab owns its document, including inactive sessions. */
export function observeWorkareaPipelineDrafts(
  store: TangentProjectStore,
  storage: PipelineStorageService,
  backendUrl: string,
) {
  const retained = new Map<string, { identity: string; release: () => void }>();
  const stop = autorun(() => {
    const pipelineTabs = new Set<string>();
    for (const [sessionId, { tabs }] of store.workareaBySession) {
      for (const tab of tabs) {
        if (tab.target.type !== "pipeline") continue;
        pipelineTabs.add(tab.id);
        const previous = retained.get(tab.id);
        if (previous?.identity === tab.target.identity) continue;
        previous?.release();
        const { key, value } = parseIdentity(tab.target.identity);
        let ref: EditorPipelineRef;
        try {
          ref =
            key === "draft"
              ? storage.getRemoteDraftRef(value, backendUrl)
              : { source: "remote", backendUrl, pipelineId: value };
        } catch {
          continue;
        }
        const release = storage.retainDocument(ref);
        const file = storage.getFile(ref);
        let stopPromotion = () => {};
        const owner = {
          identity: tab.target.identity,
          release: () => {
            stopPromotion();
            release();
          },
        };
        retained.set(tab.id, owner);
        if (key === "draft" && file)
          stopPromotion = reaction(
            () => file.remote,
            (remote) => {
              if (!remote) return;
              owner.identity = remotePipelineIdentity(remote.pipelineId);
              store.replaceWorkareaTabTarget(sessionId, tab.id, {
                type: "pipeline",
                identity: remotePipelineIdentity(remote.pipelineId),
              });
            },
            { fireImmediately: true },
          );
      }
    }
    for (const [tabId, owner] of retained) {
      if (pipelineTabs.has(tabId)) continue;
      owner.release();
      retained.delete(tabId);
    }
  });
  return () => {
    stop();
    for (const owner of retained.values()) owner.release();
    retained.clear();
  };
}

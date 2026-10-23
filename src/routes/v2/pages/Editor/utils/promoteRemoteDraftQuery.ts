import type { QueryClient } from "@tanstack/react-query";

import { EDITOR_SPEC_QUERY_KEY } from "@/routes/v2/pages/Editor/hooks/useLoadSpec";
import {
  getEditorPipelineIdentity,
  type RemotePipelineDraftRef,
  type RemotePipelineRef,
} from "@/services/pipelineStorage/types";

export function promoteRemoteDraftQuery(
  queryClient: QueryClient,
  draft: RemotePipelineDraftRef,
  remote: RemotePipelineRef,
) {
  const loaded = queryClient.getQueryData([
    EDITOR_SPEC_QUERY_KEY,
    getEditorPipelineIdentity(draft),
  ]);
  // Preserve all lifecycle inputs, including restored undo and pending saves.
  if (loaded) {
    const queryKey = [EDITOR_SPEC_QUERY_KEY, getEditorPipelineIdentity(remote)];
    // A save can finish while its session is inactive, before any remote
    // editor mounts. Keep that document until the editor owns clean disposal.
    queryClient.getQueryCache().build(queryClient, {
      queryKey,
      gcTime: Infinity,
    });
    queryClient.setQueryData(queryKey, loaded);
  }
}

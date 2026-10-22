import type { QueryClient } from "@tanstack/react-query";

import {
  EDITOR_SPEC_QUERY_KEY,
  type LoadedSpec,
} from "@/routes/v2/pages/Editor/hooks/useLoadSpec";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

/** A name-only URL and a file-ID URL can refer to the same mounted document. */
export function preserveRenamedPipelineQuery(
  queryClient: QueryClient,
  file: PipelineFile,
) {
  const previous = queryClient
    .getQueriesData<LoadedSpec>({ queryKey: [EDITOR_SPEC_QUERY_KEY] })
    .find(([, loaded]) => loaded?.file === file);
  if (!previous) return;
  const [previousKey, loaded] = previous;
  queryClient.setQueryData([EDITOR_SPEC_QUERY_KEY, file.id], loaded);
  const permission = queryClient.getQueryData([
    "driver-permission-gate",
    previousKey[1],
  ]);
  if (permission)
    queryClient.setQueryData(["driver-permission-gate", file.id], permission);
}

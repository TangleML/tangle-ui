import { useEffect } from "react";

import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
} from "@/services/pipelineStorage/types";

/** Keep ownership above Suspense so an abandoned load also gets released. */
export function useRetainDocument(ref: EditorPipelineRef | undefined): void {
  const storage = usePipelineStorage();
  const identity = ref && getEditorPipelineIdentity(ref);
  useEffect(
    () => (ref ? storage.retainDocument(ref) : undefined),
    [storage, identity],
  );
}

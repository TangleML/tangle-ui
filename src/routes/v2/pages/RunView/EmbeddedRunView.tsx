import "@xyflow/react/dist/style.css";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";

import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ComponentSpecProvider } from "@/providers/ComponentSpecProvider";
import { ContextPanelProvider } from "@/providers/ContextPanelProvider";
import { ExecutionDataProvider } from "@/providers/ExecutionDataProvider";
import {
  SharedStoreProvider,
  type SharedUIStore,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { RunViewContent } from "./RunViewV2";

interface EmbeddedRunViewProps {
  runId: string;
  /** Called with this tab's live shared store so host chat chips can focus it. */
  onStoreReady?: (store: SharedUIStore) => void;
  /** Called when this tab's shared store is no longer live. */
  onStoreClosed?: () => void;
}

/**
 * Surfaces this run view's isolated {@link SharedUIStore} to the surrounding
 * project (via callbacks) so sibling UI — the embedded chat's entity chips —
 * can navigate and focus this tab's live canvas. Callbacks are read through
 * refs so registration keys off the stable store instance, not callback
 * identity.
 */
function SharedStoreRegistrar({
  onReady,
  onClosed,
}: {
  onReady?: (store: SharedUIStore) => void;
  onClosed?: () => void;
}) {
  const store = useSharedStores();
  const onReadyRef = useRef(onReady);
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onReadyRef.current = onReady;
    onClosedRef.current = onClosed;
  });

  useEffect(() => {
    onReadyRef.current?.(store);
    return () => onClosedRef.current?.();
  }, [store]);

  return null;
}

/**
 * Embeds the run canvas (e.g. inside the Tangent workarea) with only the
 * providers `RunViewContent` requires. Unlike {@link RunViewV2}, it omits the
 * run menu bar and the `AiChatStoreProvider`, and keeps an isolated
 * `SharedStoreProvider` so its dock windows don't collide with the surrounding
 * project's windows.
 *
 * Subgraph navigation is tracked in local state (not the page URL) and fed into
 * `ExecutionDataProvider`, so entering a subgraph re-scopes execution status
 * and artifacts without navigating away from the host page. It also nests its
 * own `ComponentSpecProvider` so multiple open run tabs don't clobber the
 * app-level singleton (or each other's subgraph path).
 */
export function EmbeddedRunView({
  runId,
  onStoreReady,
  onStoreClosed,
}: EmbeddedRunViewProps) {
  const [subgraphExecutionId, setSubgraphExecutionId] = useState<
    string | undefined
  >(undefined);

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <SharedStoreRegistrar onReady={onStoreReady} onClosed={onStoreClosed} />
        <ComponentSpecProvider>
          <ReactFlowProvider>
            <ContextPanelProvider>
              <ExecutionDataProvider
                pipelineRunId={runId}
                subgraphExecutionId={subgraphExecutionId}
              >
                <ComponentLibraryProvider>
                  <RunViewContent
                    runId={runId}
                    embedded
                    onSubgraphExecutionIdChange={setSubgraphExecutionId}
                  />
                </ComponentLibraryProvider>
              </ExecutionDataProvider>
            </ContextPanelProvider>
          </ReactFlowProvider>
        </ComponentSpecProvider>
      </SharedStoreProvider>
    </div>
  );
}

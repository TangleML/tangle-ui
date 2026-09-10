import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { ForcedSearchProvider } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { DriverPermissionGate } from "./components/DriverPermissionGate";
import { TangentEditorAgentProvider } from "./components/TangentChat/TangentEditorAgentProvider";
import { PipelineEditor } from "./EditorV2";
import { EditorSessionProvider } from "./store/EditorSessionContext";

interface EmbeddedPipelineEditorProps {
  pipelineRef: PipelineRef;
  /**
   * The Tangent session this tab belongs to. When set, an editor agent host is
   * mounted so a remote sub-agent can drive this pipeline's spec via CSOM.
   */
  sessionId?: string;
  /**
   * Stable remote-env id for this tab's editor agent, so the server can route
   * spawns to it. Required (with `sessionId`) to host the agent.
   */
  environmentId?: string;
  /** Called with the connected environment id once the agent host connects. */
  onEnvironmentReady?: (environmentId: string) => void;
  /** Called when the agent host disconnects (e.g. tab close / unmount). */
  onEnvironmentClosed?: () => void;
  /** Called with this tab's live bridge so the project agent can drive it. */
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  /** Called when this tab's bridge is no longer live. */
  onBridgeClosed?: () => void;
}

/**
 * Mounts the editor agent host inside the embedded editor's store providers so
 * its `ToolBridgeApi` binds to *this* tab's live spec. A no-op when the tab has
 * no active session yet.
 */
function EmbeddedEditorAgentBoundary({
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
  children,
}: {
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
  children: ReactNode;
}) {
  if (!sessionId) return <>{children}</>;
  return (
    <TangentEditorAgentProvider
      sessionId={sessionId}
      environmentId={environmentId}
      onEnvironmentReady={onEnvironmentReady}
      onEnvironmentClosed={onEnvironmentClosed}
      onBridgeReady={onBridgeReady}
      onBridgeClosed={onBridgeClosed}
    >
      {children}
    </TangentEditorAgentProvider>
  );
}

/**
 * Embeds the pipeline canvas (e.g. inside the Tangent workarea) with only the
 * providers `PipelineEditor` requires. Unlike `EditorV2`, it omits the editor
 * chrome (menu bar), tour bridge/dialogs, and `AiChatStoreProvider`, and keeps
 * an isolated `SharedStoreProvider` so its dock windows don't collide with the
 * surrounding project's windows.
 *
 * When a `sessionId` is supplied, it additionally hosts a per-tab editor agent
 * (see {@link EmbeddedEditorAgentBoundary}) bound to this tab's spec.
 */
export function EmbeddedPipelineEditor({
  pipelineRef,
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: EmbeddedPipelineEditorProps) {
  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
      <SharedStoreProvider>
        <EditorSessionProvider>
          <EmbeddedEditorAgentBoundary
            sessionId={sessionId}
            environmentId={environmentId}
            onEnvironmentReady={onEnvironmentReady}
            onEnvironmentClosed={onEnvironmentClosed}
            onBridgeReady={onBridgeReady}
            onBridgeClosed={onBridgeClosed}
          >
            <DialogProvider>
              <ComponentLibraryProvider>
                <ReactFlowProvider>
                  <ForcedSearchProvider>
                    <DriverPermissionGate pipelineRef={pipelineRef}>
                      <PipelineEditor pipelineRef={pipelineRef} embedded />
                    </DriverPermissionGate>
                  </ForcedSearchProvider>
                </ReactFlowProvider>
              </ComponentLibraryProvider>
            </DialogProvider>
          </EmbeddedEditorAgentBoundary>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </div>
  );
}

/**
 * Wires the Tangent remote sub-agent host into the embedded editor.
 *
 * Mounted inside the session workspace (so `sessionId` exists), it builds the
 * Editor's live `ToolBridgeApi` from the spec/undo stores and hands it to
 * {@link TangentRemoteEnvProvider}, which owns the token/socket/worker
 * lifecycle. Prime can then spawn an editor sub-agent that drives the open
 * pipeline directly. It renders `children` unchanged.
 */
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useBackend } from "@/providers/BackendProvider";
import { createEditorToolBridge } from "@/routes/v2/pages/Editor/components/AiChat/toolBridge";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TangentRemoteEnvProvider } from "@/routes/v2/shared/tangent/TangentRemoteEnvProvider";

interface TangentEditorAgentProviderProps {
  sessionId: string;
  children: ReactNode;
  /**
   * A stable environment id to pin across token refreshes. Required when
   * several editor environments share one session (e.g. one per workarea tab)
   * so the server can route spawns to this specific editor. Omit for the
   * single-editor case, where the server-minted id is fine.
   */
  environmentId?: string;
  /** Called with the connected environment id after each (re)connect. */
  onEnvironmentReady?: (environmentId: string) => void;
  /** Called when the host disconnects (e.g. on unmount). */
  onEnvironmentClosed?: () => void;
  /**
   * Called with this editor's live `ToolBridgeApi` on mount, so a surrounding
   * host (e.g. the Tangent project) can drive this pipeline for spawns not
   * bound to this tab's own environment.
   */
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  /** Called when this editor unmounts and its bridge is no longer live. */
  onBridgeClosed?: () => void;
}

export function TangentEditorAgentProvider({
  sessionId,
  children,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: TangentEditorAgentProviderProps) {
  const { navigation } = useSharedStores();
  const editorSession = useEditorSession();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const authToken = authStorage.getToken();
  const backendUrlRef = useRef(backendUrl);
  const authTokenRef = useRef(authToken);

  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  // The bridge closes over the navigation/undo stores plus backend/auth
  // read lazily via refs, so a single instance survives config changes —
  // matching how `AiChatContent` builds the Sidekick bridge.
  const [bridge] = useState(() =>
    createEditorToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((entry) => entry.displayName),
      getBackendUrl: () => backendUrlRef.current,
      getAuthToken: () => authTokenRef.current,
      queryClient,
      undo: editorSession.undo,
    }),
  );

  return (
    <TangentRemoteEnvProvider
      sessionId={sessionId}
      bridge={bridge}
      context={{ mode: "editor" }}
      environmentId={environmentId}
      onEnvironmentReady={onEnvironmentReady}
      onEnvironmentClosed={onEnvironmentClosed}
      onBridgeReady={onBridgeReady}
      onBridgeClosed={onBridgeClosed}
    >
      {children}
    </TangentRemoteEnvProvider>
  );
}

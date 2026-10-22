import "@xyflow/react/dist/style.css";
import "@/styles/editor.css";

import { observer } from "mobx-react-lite";
import { useRef } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { RunSubmissionScopeProvider } from "@/providers/RunSubmissionScopeProvider";
import {
  SharedStoreProvider,
  type SharedUIStore,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { SharedStoreRegistrar } from "@/routes/v2/shared/store/SharedStoreRegistrar";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";

import {
  EditorCanvasProvider,
  EditorViewport,
} from "./components/EditorViewport";
import { RemotePipelineSaveRecovery } from "./components/RemotePipelineSaveRecovery";
import { RemotePipelineView } from "./components/RemotePipelineView/RemotePipelineView";
import { useEditorWorkspace } from "./hooks/useEditorWorkspace";
import { useEmbeddedInitialDockLayout } from "./hooks/useEmbeddedInitialDockLayout";
import { type LoadedSpec, useLoadSpec } from "./hooks/useLoadSpec";
import { useRetainDocument } from "./hooks/useRetainDocument";
import { EditorSessionProvider } from "./store/EditorSessionContext";
import { TangentEditorAgentProvider } from "./TangentEditorAgentProvider";

interface EmbeddedPipelineEditorProps {
  pipelineRef: EditorPipelineRef;
  isActive: boolean;
  projectId: string;
  onStoreReady?: (store: SharedUIStore) => void;
  onStoreClosed?: () => void;
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

interface EmbeddedEditorAgentBoundaryProps {
  sessionId?: string;
  environmentId?: string;
  onEnvironmentReady?: (environmentId: string) => void;
  onEnvironmentClosed?: () => void;
  onBridgeReady?: (bridge: ToolBridgeApi) => void;
  onBridgeClosed?: () => void;
}

interface EmbeddedPipelineEditorCanvasProps extends EmbeddedEditorAgentBoundaryProps {
  document: LoadedSpec;
  isActive: boolean;
}

/**
 * Hosts the Tangent editor sub-agent only when this editor is embedded in a
 * Tangent session. The standalone `/editor` route renders without a
 * `sessionId`, so it stays entirely agent-free.
 */
function EmbeddedEditorAgentBoundary({
  sessionId,
  ...rest
}: EmbeddedEditorAgentBoundaryProps) {
  if (!sessionId) return null;
  return <TangentEditorAgentProvider sessionId={sessionId} {...rest} />;
}

const EmbeddedPipelineEditorSkeleton = () => (
  <LoadingScreen message="Loading pipeline..." />
);

const EmbeddedPipelineEditorCanvas = withSuspenseWrapper(
  observer(
    ({
      document,
      isActive,
      ...agentBoundaryProps
    }: EmbeddedPipelineEditorCanvasProps) => {
      const canvasRef = useRef<HTMLDivElement | null>(null);
      useEditorWorkspace(document, {
        isActive,
        renderSubmitter: true,
        selection: {
          contextPanel: {
            defaultDockState: undefined,
            getInitialPosition: () => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) return { x: window.innerWidth - 340, y: 80 };
              return { x: rect.right - 300 - 12, y: rect.top + 12 };
            },
          },
        },
      });
      useEmbeddedInitialDockLayout();

      return (
        <EditorViewport canvasRef={canvasRef}>
          <EmbeddedEditorAgentBoundary {...agentBoundaryProps} />
        </EditorViewport>
      );
    },
  ),
  EmbeddedPipelineEditorSkeleton,
);

const EditableEmbeddedPipelineEditor = ({
  document,
  isActive,
  projectId,
  onStoreReady,
  onStoreClosed,
  sessionId,
  environmentId,
  onEnvironmentReady,
  onEnvironmentClosed,
  onBridgeReady,
  onBridgeClosed,
}: EmbeddedPipelineEditorProps & { document: LoadedSpec }) => {
  return (
    <RunSubmissionScopeProvider projectId={projectId}>
      <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-background select-none">
        <SharedStoreProvider>
          <SharedStoreRegistrar
            onReady={onStoreReady}
            onClosed={onStoreClosed}
          />
          <EditorSessionProvider>
            <EditorCanvasProvider>
              <RemotePipelineSaveRecovery />
              <EmbeddedPipelineEditorCanvas
                document={document}
                isActive={isActive}
                sessionId={sessionId}
                environmentId={environmentId}
                onEnvironmentReady={onEnvironmentReady}
                onEnvironmentClosed={onEnvironmentClosed}
                onBridgeReady={onBridgeReady}
                onBridgeClosed={onBridgeClosed}
              />
            </EditorCanvasProvider>
          </EditorSessionProvider>
        </SharedStoreProvider>
      </div>
    </RunSubmissionScopeProvider>
  );
};

const EmbeddedPipelineDocumentView = withSuspenseWrapper(
  (props: EmbeddedPipelineEditorProps) => {
    const { data: document } = useLoadSpec(props.pipelineRef);
    const { spec, file } = document;
    return file.canEdit !== true ? (
      <RunSubmissionScopeProvider projectId={props.projectId}>
        <RemotePipelineView spec={spec} file={file} isActive={props.isActive} />
      </RunSubmissionScopeProvider>
    ) : (
      <EditableEmbeddedPipelineEditor {...props} document={document} />
    );
  },
  EmbeddedPipelineEditorSkeleton,
);

export function EmbeddedPipelineEditor(props: EmbeddedPipelineEditorProps) {
  useRetainDocument(props.pipelineRef);
  return <EmbeddedPipelineDocumentView {...props} />;
}

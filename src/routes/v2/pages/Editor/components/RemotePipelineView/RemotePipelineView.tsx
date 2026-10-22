import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { InlineStack } from "@/components/ui/layout";
import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { createEditorAgentWorker } from "@/routes/v2/pages/Editor/components/AiChat/editorAgentWorker";
import { ViewMenu } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/ViewMenu";
import { useAiChatWindow } from "@/routes/v2/pages/Editor/hooks/useAiChatWindow";
import { useEditorEscapeShortcut } from "@/routes/v2/pages/Editor/hooks/useEditorEscapeShortcut";
import { usePipelineDetailsWindow } from "@/routes/v2/pages/Editor/hooks/usePipelineDetailsWindow";
import { useRemotePipelineUrlSync } from "@/routes/v2/pages/Editor/hooks/useRemotePipelineUrlSync";
import { useSelectionWindowSync } from "@/routes/v2/pages/Editor/hooks/useSelectionWindowSync";
import {
  EditorSessionProvider,
  useEditorSession,
} from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AiChatStoreProvider } from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import { useCanvasControlsWindow } from "@/routes/v2/shared/components/MiniMap/useCanvasControlsWindow";
import { ReadOnlyFlowCanvas } from "@/routes/v2/shared/components/ReadOnlyFlowCanvas";
import { useDockAreaAccordion } from "@/routes/v2/shared/hooks/useDockAreaAccordion";
import { useFocusMode } from "@/routes/v2/shared/hooks/useFocusMode";
import { useReadOnlySpecLifecycle } from "@/routes/v2/shared/hooks/useReadOnlySpecLifecycle";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useShortcutListener } from "@/routes/v2/shared/shortcuts/useShortcutListener";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import type { ViewPreset } from "@/routes/v2/shared/windows/viewPresets";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import { WindowManagementMenu } from "@/routes/v2/shared/windows/WindowManagementMenu";
import { useWindowPersistence } from "@/routes/v2/shared/windows/windowPersistence";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { getEditorPipelineIdentity } from "@/services/pipelineStorage/types";

import { RemotePipelineActions } from "./RemotePipelineActions";
import { RemotePipelineShell } from "./RemotePipelineShell";
import { remotePipelineViewRegistry } from "./remotePipelineViewRegistry";

const VIEW_PRESETS: ViewPreset[] = [
  {
    label: "Default",
    description: "Pipeline tools, Sidekick, pipeline details, and minimap",
    visible: new Set([
      "pipeline-tools",
      "ai-assistant-chat",
      "pipeline-details",
      "canvas-controls",
    ]),
    dockAreas: {
      left: ["pipeline-tools", "ai-assistant-chat"],
      right: ["pipeline-details", "context-panel"],
    },
  },
];

const RemotePipelineContent = observer(function RemotePipelineContent({
  spec,
  isActive,
  pipelineId,
  file,
}: {
  spec: ComponentSpec;
  isActive: boolean;
  pipelineId?: string;
  file?: PipelineFile;
}) {
  const { navigation, windows } = useSharedStores();
  const { pipelineFile } = useEditorSession();
  useWindowPersistence("pipeline-view");
  useReadOnlySpecLifecycle(spec);
  useShortcutListener(isActive);
  useDockAreaAccordion();
  usePipelineDetailsWindow({
    readOnly: true,
    ownerId: file?.folder.driver.ownerId,
  });
  useSelectionWindowSync({ readOnly: true });
  useCanvasControlsWindow("v2.pipeline_canvas", false);
  useFocusMode(VIEW_PRESETS[0]);
  useEditorEscapeShortcut();

  useEffect(() => {
    pipelineFile.init(file ?? null);
    return () => pipelineFile.dispose();
  }, [pipelineFile, file]);
  useRemotePipelineUrlSync(spec, pipelineId);

  useEffect(() => {
    if (!windows.getWindowById("pipeline-tools")) {
      windows.openWindow(<RemotePipelineActions file={file} />, {
        id: "pipeline-tools",
        title: "Pipeline Tools",
        defaultVisible: true,
        defaultDockState: "left",
        disabledActions: ["close", "maximize"],
        variant: "panel",
        persisted: true,
        size: { width: 280, height: 240 },
        renderMiniInline: true,
        miniContent: <RemotePipelineActions file={file} layout="rail" />,
      });
    }
  }, [windows, file]);

  const aiEnabled = useFlagValue("ai-assistant");
  useAiChatWindow(aiEnabled, { readOnly: true });

  const activeSpec = navigation.activeSpec;

  return (
    <RemotePipelineShell
      name={spec.name || "Untitled pipeline"}
      menus={
        <>
          <ViewMenu />
          <WindowManagementMenu
            presets={VIEW_PRESETS}
            trackingPrefix="v2.pipeline_view.windows_menu"
          />
        </>
      }
    >
      {activeSpec && (
        <SpecProvider spec={activeSpec}>
          <InlineStack
            className="flex-1 min-h-0 w-full"
            blockAlign="stretch"
            wrap="nowrap"
          >
            <DockArea side="left" />
            <div className="relative flex-1 min-w-0 h-full">
              <ReadOnlyFlowCanvas
                key={activeSpec.$id}
                spec={activeSpec}
                nodesDraggable={false}
                className="h-full"
              />
              <WindowContainer />
            </div>
            <DockArea side="right" />
          </InlineStack>
        </SpecProvider>
      )}
    </RemotePipelineShell>
  );
});

export function RemotePipelineView({
  spec,
  isActive = true,
  pipelineId,
  file,
}: {
  spec: ComponentSpec;
  isActive?: boolean;
  pipelineId?: string;
  file?: PipelineFile;
}) {
  const identity = file?.remote
    ? getEditorPipelineIdentity({ source: "remote", ...file.remote })
    : (file?.initialId ?? pipelineId ?? spec.$id);
  return (
    <ComponentLibraryProvider>
      <SharedStoreProvider key={identity}>
        <EditorSessionProvider>
          <AiChatStoreProvider
            createWorker={createEditorAgentWorker}
            context={{ mode: "editor", readOnly: true }}
          >
            <DialogProvider>
              <ComponentEditorProvider>
                <ReactFlowProvider>
                  <NodeRegistryProvider registry={remotePipelineViewRegistry}>
                    <RemotePipelineContent
                      spec={spec}
                      isActive={isActive}
                      pipelineId={pipelineId}
                      file={file}
                    />
                  </NodeRegistryProvider>
                </ReactFlowProvider>
              </ComponentEditorProvider>
            </DialogProvider>
          </AiChatStoreProvider>
        </EditorSessionProvider>
      </SharedStoreProvider>
    </ComponentLibraryProvider>
  );
}

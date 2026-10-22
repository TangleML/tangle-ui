import { ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";
import type { ReactNode, Ref } from "react";

import { ComponentEditorProvider } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { InlineStack } from "@/components/ui/layout";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { editorRegistry } from "@/routes/v2/pages/Editor/nodes";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";

import { FlowCanvas } from "./FlowCanvas/FlowCanvas";
import { QuickRunSubmitterProvider } from "./QuickRunSubmitterContext";

export function EditorCanvasProvider({ children }: { children: ReactNode }) {
  return (
    <ComponentLibraryProvider>
      <ComponentEditorProvider>
        <ReactFlowProvider>
          <QuickRunSubmitterProvider>{children}</QuickRunSubmitterProvider>
        </ReactFlowProvider>
      </ComponentEditorProvider>
    </ComponentLibraryProvider>
  );
}

export const EditorViewport = observer(function EditorViewport({
  leftDock,
  canvasRef,
  children,
}: {
  leftDock?: ReactNode;
  canvasRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  const { navigation } = useSharedStores();
  const spec = navigation.activeSpec;
  if (!spec) return null;

  return (
    <>
      <NodeRegistryProvider registry={editorRegistry}>
        <SpecProvider spec={spec}>
          <InlineStack
            className="flex-1 min-h-0 w-full"
            blockAlign="stretch"
            wrap="nowrap"
            data-testid="editor-v2"
            data-editor-ready="true"
          >
            {leftDock}
            <div
              ref={canvasRef}
              className="relative flex-1 min-w-0 h-full"
              data-tour="editor-canvas"
            >
              <FlowCanvas key={spec.$id} spec={spec} className="h-full" />
              <WindowContainer />
            </div>
            <DockArea side="right" />
          </InlineStack>
        </SpecProvider>
      </NodeRegistryProvider>
      {children}
    </>
  );
});

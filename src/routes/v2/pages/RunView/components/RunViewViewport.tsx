import { observer } from "mobx-react-lite";
import type { ReactNode, Ref } from "react";

import { InlineStack } from "@/components/ui/layout";
import { runViewRegistry } from "@/routes/v2/pages/RunView/nodes";
import { ReadOnlyFlowCanvas } from "@/routes/v2/shared/components/ReadOnlyFlowCanvas";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";

import { RunViewSelectionToolbar } from "./RunViewSelectionToolbar";

interface RunViewViewportProps {
  header?: ReactNode;
  leftDock?: ReactNode;
  canvasRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

export const RunViewViewport = observer(function RunViewViewport({
  header,
  leftDock,
  canvasRef,
  children,
}: RunViewViewportProps) {
  const { navigation } = useSharedStores();
  const spec = navigation.activeSpec;
  if (!spec) return null;

  return (
    <>
      <NodeRegistryProvider registry={runViewRegistry}>
        <SpecProvider spec={spec}>
          {header}
          <InlineStack
            className="flex-1 min-h-0 w-full"
            blockAlign="stretch"
            wrap="nowrap"
            data-testid="run-view-v2"
          >
            {leftDock}
            <div ref={canvasRef} className="relative flex-1 min-w-0 h-full">
              <ReadOnlyFlowCanvas key={spec.$id} spec={spec} className="h-full">
                <RunViewSelectionToolbar spec={spec} />
              </ReadOnlyFlowCanvas>
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

import { observer } from "mobx-react-lite";
import { useState } from "react";

import GraphComponents from "@/components/shared/ReactFlow/FlowSidebar/sections/GraphComponents";
import { BlockStack } from "@/components/ui/layout";
import { DashboardComponentsView } from "@/routes/Dashboard/DashboardComponentsView";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";

/**
 * Wrapper component that renders the component library inside a Window.
 * GraphComponents is used when the window is not maximized; when maximized,
 * the full dashboard-style browser is shown instead.
 */
export const ComponentLibraryContent = observer(
  function ComponentLibraryContent() {
    const { model } = useWindowContext();
    const [selectedComponentDigest, setSelectedComponentDigest] = useState<
      string | undefined
    >();

    if (model.isMaximized) {
      return (
        <BlockStack className="h-full min-h-0 overflow-hidden">
          <DashboardComponentsView
            embedInEditorWindow
            selectedComponentDigest={selectedComponentDigest}
            onSelectComponentDigest={setSelectedComponentDigest}
          />
        </BlockStack>
      );
    }

    return (
      <BlockStack className="h-full min-h-0 overflow-y-auto">
        <GraphComponents />
      </BlockStack>
    );
  },
);

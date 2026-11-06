import { observer } from "mobx-react-lite";
import { useState } from "react";

import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useChatPaneWidth } from "@/routes/v2/pages/Tangent/hooks/useChatPaneWidth";
import { useNarrowLayoutDock } from "@/routes/v2/pages/Tangent/hooks/useNarrowLayoutDock";
import { useTangentProjectWindows } from "@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows";
import { useTangentSessionParam } from "@/routes/v2/pages/Tangent/hooks/useTangentSessionParam";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { COLLAPSED_DOCK_AREA_WIDTH } from "@/routes/v2/shared/windows/types";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import { useWindowPersistence } from "@/routes/v2/shared/windows/windowPersistence";

import { CollapsedWorkareaRail } from "./CollapsedWorkareaRail";
import { DynamicWorkarea } from "./DynamicWorkarea";
import { ProjectChatArea } from "./ProjectChatArea";
import { ProjectHeader } from "./ProjectHeader";
import { TangentProjectAgentProvider } from "./TangentProjectAgentProvider";
import { WorkareaDivider } from "./WorkareaDivider";

export const TangentProjectWorkspace = observer(
  function TangentProjectWorkspace() {
    useWindowPersistence("tangent-project");
    useTangentProjectWindows();
    const store = useTangentProject();
    useNarrowLayoutDock(store.workareaCollapsed);
    useTangentSessionParam(store);
    const { windows } = useSharedStores();
    const dock = windows.getDockAreaConfig("left");
    const dockWidth = dock.collapsed ? COLLAPSED_DOCK_AREA_WIDTH : dock.width;
    const {
      rowRef,
      rowMeasured,
      width: chatWidth,
      maxWidth: maxChatWidth,
      requestWidth,
    } = useChatPaneWidth(dockWidth);
    const [collapsePreview, setCollapsePreview] = useState(false);

    return (
      <TangentProjectAgentProvider sessionId={store.activeSessionId}>
        <div className="flex h-full w-full flex-col">
          <ProjectHeader />
          <InlineStack
            ref={rowRef}
            className="min-h-0 min-w-0 flex-1"
            blockAlign="stretch"
            wrap="nowrap"
          >
            <DockArea side="left" />
            <div
              className={cn(
                "relative flex min-h-0 min-w-0 flex-col",
                store.workareaCollapsed ? "w-0 flex-1" : "shrink-0",
              )}
              style={{ width: store.workareaCollapsed ? undefined : chatWidth }}
            >
              {!store.workareaCollapsed && (
                <WorkareaDivider
                  rowMeasured={rowMeasured}
                  maxChatWidth={maxChatWidth}
                  onResize={requestWidth}
                  onCollapsePreview={setCollapsePreview}
                />
              )}
              <ProjectChatArea />
              <WindowContainer />
            </div>
            <DynamicWorkarea collapsePreview={collapsePreview} />
            {store.workareaCollapsed && <CollapsedWorkareaRail />}
          </InlineStack>
        </div>
      </TangentProjectAgentProvider>
    );
  },
);

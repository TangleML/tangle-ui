import { observer } from "mobx-react-lite";

import { InlineStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useChatPaneWidth } from "@/routes/v2/pages/Tangent/hooks/useChatPaneWidth";
import { useNarrowLayoutDock } from "@/routes/v2/pages/Tangent/hooks/useNarrowLayoutDock";
import { useTangentProjectWindows } from "@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows";
import { useTangentSessionParam } from "@/routes/v2/pages/Tangent/hooks/useTangentSessionParam";
import { MIN_CHAT_WIDTH } from "@/routes/v2/pages/Tangent/layout";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
import { COLLAPSED_DOCK_AREA_WIDTH } from "@/routes/v2/shared/windows/types";
import { WindowContainer } from "@/routes/v2/shared/windows/WindowContainer";
import { useWindowPersistence } from "@/routes/v2/shared/windows/windowPersistence";

import { DynamicWorkarea } from "./DynamicWorkarea";
import { ProjectChatArea } from "./ProjectChatArea";
import { ProjectHeader } from "./ProjectHeader";
import { TangentProjectAgentProvider } from "./TangentProjectAgentProvider";

export const TangentProjectWorkspace = observer(
  function TangentProjectWorkspace() {
    useWindowPersistence("tangent-project");
    useTangentProjectWindows();
    useNarrowLayoutDock();
    const store = useTangentProject();
    useTangentSessionParam(store);
    const { windows } = useSharedStores();
    const dock = windows.getDockAreaConfig("left");
    const {
      rowRef,
      width: chatWidth,
      maxWidth: maxChatWidth,
      requestWidth,
    } = useChatPaneWidth(
      dock.collapsed ? COLLAPSED_DOCK_AREA_WIDTH : dock.width,
    );

    return (
      <TangentProjectAgentProvider sessionId={store.activeSessionId}>
        <div className="flex h-full w-full flex-col">
          <ProjectHeader />
          <InlineStack
            ref={rowRef}
            className="min-h-0 flex-1"
            blockAlign="stretch"
            wrap="nowrap"
          >
            <DockArea side="left" />
            <div
              className="relative flex min-h-0 shrink-0 flex-col"
              style={{ width: chatWidth }}
            >
              <VerticalResizeHandle
                side="right"
                minWidth={MIN_CHAT_WIDTH}
                maxWidth={maxChatWidth}
                onResizeEnd={requestWidth}
              />
              <ProjectChatArea />
              <WindowContainer />
            </div>
            <DynamicWorkarea />
          </InlineStack>
        </div>
      </TangentProjectAgentProvider>
    );
  },
);

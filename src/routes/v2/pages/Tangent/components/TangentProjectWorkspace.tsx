import { observer } from "mobx-react-lite";
import { useState } from "react";

import { InlineStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useNarrowLayoutDock } from "@/routes/v2/pages/Tangent/hooks/useNarrowLayoutDock";
import { useTangentProjectWindows } from "@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows";
import { useTangentSessionParam } from "@/routes/v2/pages/Tangent/hooks/useTangentSessionParam";
import {
  DEFAULT_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
} from "@/routes/v2/pages/Tangent/layout";
import { DockArea } from "@/routes/v2/shared/windows/DockArea";
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
    const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);

    return (
      <TangentProjectAgentProvider sessionId={store.activeSessionId}>
        <div className="flex h-full w-full flex-col">
          <ProjectHeader />
          <InlineStack
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
                maxWidth={MAX_CHAT_WIDTH}
                onResizeEnd={(attempted) =>
                  setChatWidth(
                    Math.max(
                      MIN_CHAT_WIDTH,
                      Math.min(MAX_CHAT_WIDTH, attempted),
                    ),
                  )
                }
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

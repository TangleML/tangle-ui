import { observer } from "mobx-react-lite";

import { InlineStack } from "@/components/ui/layout";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useTangentProjectWindows } from "@/routes/v2/pages/Tangent/hooks/useTangentProjectWindows";
import { useTangentSessionParam } from "@/routes/v2/pages/Tangent/hooks/useTangentSessionParam";
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
    const store = useTangentProject();
    useTangentSessionParam(store);

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
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
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

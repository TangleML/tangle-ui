import { Chat } from "@tangent/embed-react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import {
  SCROLLING_TAB_STRIP,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CloseableTabTrigger } from "@/routes/v2/pages/Tangent/components/CloseableTabTrigger";
import {
  type AgentTab,
  CHAT_TAB_VALUE,
} from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

const FORCE_MOUNTED_TAB_PANEL =
  "min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden";

interface TangentChatPaneProps {
  sessionId: string;
  tabs: AgentTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onCloseTab: (id: string) => void;
  onOpenArtifact?: (url: string, title: string) => void;
  onSendPrompt?: (content: string) => void;
  onError?: (message: string) => void;
  headerAction?: ReactNode;
}

/**
 * The tabbed Tangent chat surface: a Prime "Chat" tab plus one tab per opened
 * sub-agent. Shared by the editor's docked Tangent window and the Tangent
 * Shell project workspace so their chat behavior stays in sync.
 */
export function TangentChatPane({
  sessionId,
  tabs,
  activeTab,
  onTabChange,
  onCloseTab,
  onOpenArtifact,
  onSendPrompt,
  onError,
  headerAction,
}: TangentChatPaneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex h-full min-h-0 flex-col gap-1"
      >
        <InlineStack
          gap="2"
          align="space-between"
          blockAlign="center"
          className="w-full shrink-0"
        >
          <TabsList className={cn("min-w-0 max-w-full", SCROLLING_TAB_STRIP)}>
            <TabsTrigger value={CHAT_TAB_VALUE}>
              <Icon name="MessageSquare" size="xs" />
              Chat
            </TabsTrigger>
            {tabs.map((tab) => (
              <CloseableTabTrigger
                key={tab.id}
                value={tab.id}
                title={tab.title}
                onClose={() => onCloseTab(tab.id)}
              />
            ))}
          </TabsList>
          {headerAction}
        </InlineStack>
        <TabsContent
          value={CHAT_TAB_VALUE}
          forceMount
          className={FORCE_MOUNTED_TAB_PANEL}
        >
          <Chat
            sessionId={sessionId}
            autoFocus
            className="h-full min-h-0"
            style={{ height: "100%" }}
            onOpenArtifact={onOpenArtifact}
            onSendPrompt={onSendPrompt}
            onError={onError}
          />
        </TabsContent>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            forceMount
            className={FORCE_MOUNTED_TAB_PANEL}
          >
            <Chat
              sessionId={sessionId}
              agentId={tab.id}
              className="h-full min-h-0"
              style={{ height: "100%" }}
              onOpenArtifact={onOpenArtifact}
              onSendPrompt={onSendPrompt}
              onError={onError}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

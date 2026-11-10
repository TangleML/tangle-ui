import {
  Chat,
  type EmbedAgent,
  type EmbedReference,
} from "@tangent/embed-react";
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
  onOpenAgent?: (agent: EmbedAgent) => void;
  onRemoveAgent?: (id: string) => void;
  references?: EmbedReference[];
  onOpenArtifact?: (url: string, title: string) => void;
  onSendPrompt?: (content: string) => void;
  onError?: (message: string) => void;
  onResourcesChange?: () => void;
  headerAction?: ReactNode;
}

/**
 * The tabbed Tangent chat surface: a "Prime" tab plus one tab per opened
 * sub-agent. Shared by the editor's docked Tangent window and the Tangent
 * Shell project workspace so their chat behavior stays in sync.
 */
export function TangentChatPane({
  sessionId,
  tabs,
  activeTab,
  onTabChange,
  onCloseTab,
  onOpenAgent,
  onRemoveAgent,
  references,
  onOpenArtifact,
  onSendPrompt,
  onError,
  onResourcesChange,
  headerAction,
}: TangentChatPaneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <InlineStack
          wrap="nowrap"
          className="w-full shrink-0 shadow-[inset_0_-1px_0_var(--border)]"
        >
          <TabsList
            variant="line"
            className={cn("min-w-0 flex-1", SCROLLING_TAB_STRIP)}
          >
            <TabsTrigger value={CHAT_TAB_VALUE}>
              <Icon name="MessageSquare" size="xs" />
              Prime
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
          {headerAction && <div className="shrink-0 px-2">{headerAction}</div>}
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
            onOpenAgent={onOpenAgent}
            onRemoveAgent={onRemoveAgent}
            references={references}
            onOpenArtifact={onOpenArtifact}
            onSendPrompt={onSendPrompt}
            onError={onError}
            onResourcesChange={onResourcesChange}
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
              onOpenAgent={onOpenAgent}
              onRemoveAgent={onRemoveAgent}
              references={references}
              onOpenArtifact={onOpenArtifact}
              onSendPrompt={onSendPrompt}
              onError={onError}
              onResourcesChange={onResourcesChange}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

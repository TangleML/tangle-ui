import {
  Chat,
  type EmbedAgent,
  type EmbedCommand,
  type EmbedReference,
} from "@tangent/embed-react";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";

import { Icon } from "@/components/ui/icon";
import { Tabs, TabsContent, TabsTrigger, TabStrip } from "@/components/ui/tabs";
import type { TangentMessageTarget } from "@/routes/tangentSearch";
import { CloseableTabTrigger } from "@/routes/v2/pages/Tangent/components/CloseableTabTrigger";
import {
  type AgentTab,
  CHAT_TAB_VALUE,
} from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { getProjectUrl } from "@/utils/URL";

const FORCE_MOUNTED_TAB_PANEL =
  "min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden";

interface TangentChatPaneProps {
  projectId?: string;
  sessionId: string;
  message?: TangentMessageTarget;
  tabs: AgentTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  onCloseTab: (id: string) => void;
  onOpenAgent?: (agent: EmbedAgent) => void;
  onRemoveAgent?: (id: string) => void;
  references?: EmbedReference[];
  commands?: EmbedCommand[];
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
  projectId,
  sessionId,
  message,
  tabs,
  activeTab,
  onTabChange,
  onCloseTab,
  onOpenAgent,
  onRemoveAgent,
  references,
  commands,
  onOpenArtifact,
  onSendPrompt,
  onError,
  onResourcesChange,
  headerAction,
}: TangentChatPaneProps) {
  const sharedChatProps = {
    projectId,
    sessionId,
    onOpenAgent,
    onRemoveAgent,
    references,
    onOpenArtifact,
    onSendPrompt,
    onError,
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <TabStrip trailing={headerAction}>
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
        </TabStrip>
        <ChatPanel
          {...sharedChatProps}
          autoFocus={!message}
          targetAgentId={message?.agentId}
          targetMessageId={
            activeTab === CHAT_TAB_VALUE && !message?.agentId
              ? message?.messageId
              : undefined
          }
          commands={commands}
          // Every chat of a session reports the same changes, so only
          // this one, which is always mounted, is listened to.
          onResourcesChange={onResourcesChange}
        />
        {tabs.map((tab) => (
          <ChatPanel
            key={tab.id}
            {...sharedChatProps}
            agentId={tab.id}
            targetMessageId={
              activeTab === tab.id && message?.agentId === tab.id
                ? message.messageId
                : undefined
            }
          />
        ))}
      </Tabs>
    </div>
  );
}

interface MessageLinkChatElement extends HTMLElement {
  getMessageLink?: (messageId: string) => string | undefined;
  targetMessageId?: string;
  targetAgentId?: string;
}

function ChatPanel({
  projectId,
  sessionId,
  agentId,
  targetAgentId,
  targetMessageId,
  ...props
}: ComponentProps<typeof Chat> & {
  projectId?: string;
  targetAgentId?: string;
  targetMessageId?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // The React package mounts the public element and binds the session first.
  // The served Tangent runtime owns its message links and transcript scrolling.
  useEffect(() => {
    const chat =
      panel.current?.querySelector<MessageLinkChatElement>("tangent-chat");
    if (!chat) return;
    chat.getMessageLink = projectId
      ? (messageId) =>
          getProjectUrl(projectId, sessionId, { messageId, agentId })
      : undefined;
    chat.targetAgentId = targetAgentId;
    chat.targetMessageId = targetMessageId;
  }, [projectId, sessionId, agentId, targetAgentId, targetMessageId]);

  return (
    <TabsContent
      ref={panel}
      value={agentId ?? CHAT_TAB_VALUE}
      forceMount
      className={FORCE_MOUNTED_TAB_PANEL}
    >
      <Chat
        {...props}
        sessionId={sessionId}
        agentId={agentId}
        className="h-full min-h-0"
        style={{ height: "100%" }}
      />
    </TabsContent>
  );
}

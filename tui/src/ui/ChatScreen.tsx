import {
  type ChatClient,
  type ChatState,
  createChatState,
  tabInfos,
  workingConversations,
} from "@tangent/chat-client";
import { Box, type DOMElement, measureElement, Text, useInput } from "ink";
import open from "open";
import { useEffect, useRef, useState } from "react";

import { findCommand, parseCommand } from "../commands/builtins.ts";
import type { CommandContext } from "../commands/types.ts";
import type { TuiConfig } from "../config.ts";
import type { TangleRestClient } from "../tangleRestClient.ts";
import { clampScrollOffset, topOffsetFromBottom } from "./scroll.ts";
import { SessionStatus } from "./SessionStatus.tsx";
import { Tabs } from "./Tabs.tsx";
import { TextInput } from "./TextInput.tsx";
import { Transcript } from "./Transcript.tsx";
import type { ActiveProject } from "./types.ts";
import { useSpinnerFrame } from "./useSpinnerFrame.ts";
import { useTerminalSize } from "./useTerminalSize.ts";

const MAX_SYSTEM_LINES = 8;

interface ChatScreenProps {
  config: TuiConfig;
  tangle: TangleRestClient;
  active: ActiveProject;
  sessionId: string;
  chat: ChatClient;
  goToSessions: () => void;
  reset: () => Promise<void>;
}

export function ChatScreen({
  config,
  tangle,
  active,
  sessionId,
  chat,
  goToSessions,
  reset,
}: ChatScreenProps) {
  const [state, setState] = useState<ChatState>(() =>
    createChatState(sessionId),
  );
  const [value, setValue] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [systemLines, setSystemLines] = useState<string[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const { rows, columns } = useTerminalSize();
  const viewportRef = useRef<DOMElement | null>(null);
  const contentRef = useRef<DOMElement | null>(null);

  useEffect(() => chat.subscribe(setState), [chat]);

  useEffect(() => {
    if (viewportRef.current) {
      setViewportHeight(measureElement(viewportRef.current).height);
    }
    if (contentRef.current) {
      setContentHeight(measureElement(contentRef.current).height);
    }
  });

  const { order } = state;
  const activeConversationId = order[tabIndex] ?? null;
  const activeConversation = activeConversationId
    ? (state.conversations[activeConversationId] ?? null)
    : null;

  useEffect(() => {
    if (tabIndex > order.length - 1) {
      setTabIndex(Math.max(0, order.length - 1));
    }
  }, [order.length, tabIndex]);

  const needsHydration =
    activeConversationId !== null &&
    activeConversationId !== state.primaryConversationId &&
    activeConversation !== null &&
    !activeConversation.hydrated;

  useEffect(() => {
    if (needsHydration && activeConversationId) {
      chat.subscribeConversation(activeConversationId);
    }
  }, [needsHydration, activeConversationId, chat]);

  useEffect(() => {
    setScrollOffset(0);
  }, [activeConversationId]);

  useInput((_input, key) => {
    function scrollBy(lines: number): void {
      setScrollOffset((current) =>
        clampScrollOffset(current + lines, contentHeight, viewportHeight),
      );
    }
    if (key.upArrow) return scrollBy(1);
    if (key.downArrow) return scrollBy(-1);
    if (key.pageUp) return scrollBy(viewportHeight);
    if (key.pageDown) return scrollBy(-viewportHeight);
    if (order.length === 0) return;
    if (key.tab || key.rightArrow) {
      setTabIndex((current) => (current + 1) % order.length);
    } else if (key.leftArrow) {
      setTabIndex((current) => (current - 1 + order.length) % order.length);
    }
  });

  function print(line: string): void {
    setSystemLines((previous) => [...previous, line].slice(-MAX_SYSTEM_LINES));
  }

  function buildContext(): CommandContext {
    return {
      print,
      config,
      project: active.project,
      shellUrl: active.shellUrl,
      sessionId,
      subagents: state.subagents,
      tangle,
      shell: active.shell,
      host: active.host,
      userEmail: active.userEmail,
      openWeb: async (path) => {
        await open(`${config.uiUrl}${path}`);
      },
      goToSessions,
      reset,
    };
  }

  async function handleSubmit(input: string): Promise<void> {
    const text = input.trim();
    setValue("");
    if (!text) return;
    const parsed = parseCommand(text);
    if (parsed) {
      const command = findCommand(parsed.name);
      if (!command) {
        print(`Unknown command: /${parsed.name} (try /help)`);
        return;
      }
      await command.run(buildContext(), parsed.args);
      return;
    }
    chat.send(text, activeConversationId ?? undefined);
  }

  const tabs = tabInfos(state);
  const working = workingConversations(state);
  const frame = useSpinnerFrame(working.length > 0);

  const clampedOffset = clampScrollOffset(
    scrollOffset,
    contentHeight,
    viewportHeight,
  );
  const topOffset = topOffsetFromBottom(
    scrollOffset,
    contentHeight,
    viewportHeight,
  );

  return (
    <Box flexDirection="column" height={rows} width={columns}>
      <Box flexDirection="column" flexShrink={0} paddingX={1}>
        <Text bold color="magenta">
          {active.project.name}
        </Text>
        <Text dimColor>
          session {sessionId} · {config.apiUrl}
        </Text>
        <Box marginTop={1}>
          <Tabs tabs={tabs} activeIndex={tabIndex} frame={frame} />
        </Box>
      </Box>

      <Box
        ref={viewportRef}
        flexGrow={1}
        flexDirection="column"
        overflow="hidden"
        paddingX={1}
        marginTop={1}
      >
        <Box
          ref={contentRef}
          flexDirection="column"
          flexShrink={0}
          marginTop={-topOffset}
        >
          <Transcript conversation={activeConversation} />
        </Box>
      </Box>

      <Box flexDirection="column" flexShrink={0} paddingX={1} marginTop={1}>
        <SessionStatus working={working} frame={frame} />

        {state.error ? (
          <Box marginTop={1}>
            <Text color="red">{state.error}</Text>
          </Box>
        ) : null}

        {systemLines.length > 0 ? (
          <Box marginTop={1} flexDirection="column">
            {systemLines.map((line, index) => (
              <Text key={index} dimColor>
                {line}
              </Text>
            ))}
          </Box>
        ) : null}

        <Box marginTop={1} flexDirection="column">
          {clampedOffset > 0 ? (
            <Text color="yellow">
              ↑ {clampedOffset} more line{clampedOffset === 1 ? "" : "s"} above
              · ↓/PgDn for latest
            </Text>
          ) : null}
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={(input) => void handleSubmit(input)}
            placeholder="Message Prime, or /help"
          />
          <Text dimColor>
            Enter to send · Tab/←→ switch threads · ↑↓/PgUp/PgDn scroll · /help
            · Ctrl+C to quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

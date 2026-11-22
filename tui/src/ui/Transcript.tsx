import type { ConversationState } from "@tangent/chat-client";
import type { ChatMessage } from "@tangent/shared/contracts.ts";
import { Box, Text } from "ink";

import { Markdown } from "./Markdown.tsx";

const MAX_VISIBLE_MESSAGES = 50;
const MAX_THINKING_CHARS = 280;

function timeOf(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageView({ message }: { message: ChatMessage }) {
  const isHuman = message.author.kind === "human";
  const color = isHuman ? "green" : "cyan";
  const thinking = message.thinking?.trim();
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text bold color={color}>
          {message.author.name}
        </Text>
        <Text dimColor>, {timeOf(message.createdAt)}:</Text>
      </Text>
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={color}
        borderTop={false}
        borderRight={false}
        borderBottom={false}
        paddingLeft={1}
      >
        {isHuman ? (
          <Text>{message.content}</Text>
        ) : (
          <>
            {thinking ? (
              <Text dimColor>
                {thinking.length > MAX_THINKING_CHARS
                  ? `${thinking.slice(0, MAX_THINKING_CHARS)}…`
                  : thinking}
              </Text>
            ) : null}
            {message.content.trim() ? (
              <Markdown>{message.content}</Markdown>
            ) : thinking ? null : (
              <Text dimColor>…</Text>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

interface TranscriptProps {
  conversation: ConversationState | null;
}

export function Transcript({ conversation }: TranscriptProps) {
  if (!conversation) {
    return <Text dimColor>No conversation selected.</Text>;
  }
  if (conversation.messages.length === 0) {
    return <Text dimColor>No messages yet. Say hello to Prime below.</Text>;
  }
  const visible = conversation.messages.slice(-MAX_VISIBLE_MESSAGES);
  return (
    <Box flexDirection="column">
      {visible.map((message) => (
        <MessageView key={message.id} message={message} />
      ))}
      {conversation.activity ? (
        <Text color="yellow">⠿ {conversation.activity.label}</Text>
      ) : null}
    </Box>
  );
}

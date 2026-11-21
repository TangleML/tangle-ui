import { Box, Text } from "ink";

import type { WorkingAgent } from "../chatState.ts";

interface SessionStatusProps {
  working: WorkingAgent[];
  frame: string;
}

export function SessionStatus({ working, frame }: SessionStatusProps) {
  if (working.length === 0) {
    return <Text dimColor>● Idle — waiting for your message</Text>;
  }

  const count = working.length;
  return (
    <Box flexDirection="column">
      <Text color="yellow">
        {frame} Working — {count} {count === 1 ? "agent" : "agents"} active
      </Text>
      {working.map((agent) => (
        <Text key={agent.id} dimColor>
          {"   "}
          {agent.title}: {agent.label}
        </Text>
      ))}
    </Box>
  );
}

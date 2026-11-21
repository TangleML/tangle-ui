import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";

import type { Session } from "../shellClient.ts";
import { SelectList } from "./SelectList.tsx";
import type { ActiveProject } from "./types.ts";

interface SessionScreenProps {
  active: ActiveProject;
  onOpen: (sessionId: string) => void;
  onStart: (name?: string) => void;
}

export function SessionScreen({ active, onOpen, onStart }: SessionScreenProps) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    active.shell
      .listSessionsByProject(active.project.id)
      .then((loaded) => {
        if (!cancelled) setSessions(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (autoStarted.current) return;
    if (error || sessions === null || sessions.length > 0) return;
    autoStarted.current = true;
    onStart();
  }, [sessions, error, onStart]);

  useInput(
    (input) => {
      if (input === "n") onStart();
    },
    { isActive: sessions !== null && sessions.length > 0 },
  );

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="magenta">
        {active.project.name} · Sessions
      </Text>
      <Text dimColor>{active.shellUrl}</Text>
      {error ? <Text color="red">{error}</Text> : null}

      {sessions === null && !error ? (
        <Text dimColor>Loading sessions…</Text>
      ) : null}

      {sessions !== null && sessions.length === 0 && !error ? (
        <Text dimColor>No sessions yet — starting one…</Text>
      ) : null}

      {sessions !== null && sessions.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          <SelectList
            items={sessions}
            getKey={(session) => session.id}
            getLabel={(session) => session.name}
            onSelect={(session) => onOpen(session.id)}
          />
          <Box marginTop={1}>
            <Text dimColor>
              ↑/↓ to move · Enter to open · n for a new session
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

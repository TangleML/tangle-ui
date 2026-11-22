import { ChatClient } from "@tangent/chat-client";
import { createUnsignedJwt } from "@tangent/local-agent-host/remoteEnvToken.ts";
import { Box, Text } from "ink";
import { useEffect, useRef, useState } from "react";

import { authFetch, ensureCookie } from "../auth.ts";
import { resetConnection, saveConfig, type TuiConfig } from "../config.ts";
import { startLocalAgentHost } from "../localAgentHost.ts";
import { startProjectSession } from "../session.ts";
import { ShellClient } from "../shellClient.ts";
import {
  type Project,
  tangentBaseUrlOf,
  TangleRestClient,
} from "../tangleRestClient.ts";
import { ChatScreen } from "./ChatScreen.tsx";
import { ConnectScreen } from "./ConnectScreen.tsx";
import { ProjectScreen } from "./ProjectScreen.tsx";
import { SessionScreen } from "./SessionScreen.tsx";
import type { ActiveProject } from "./types.ts";

type Phase = "connect" | "projects" | "opening" | "sessions" | "chat";

interface AppProps {
  initialConfig: TuiConfig | null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function App({ initialConfig }: AppProps) {
  const [phase, setPhase] = useState<Phase>(
    initialConfig ? "projects" : "connect",
  );
  const [config, setConfig] = useState<TuiConfig | null>(initialConfig);
  const [tangle, setTangle] = useState<TangleRestClient | null>(() =>
    initialConfig
      ? new TangleRestClient(
          initialConfig.apiUrl,
          authFetch(initialConfig.apiUrl),
        )
      : null,
  );
  const [active, setActive] = useState<ActiveProject | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatClient | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef<ActiveProject | null>(null);
  const chatRef = useRef<ChatClient | null>(null);
  activeRef.current = active;
  chatRef.current = chat;

  useEffect(
    () => () => {
      chatRef.current?.dispose();
      activeRef.current?.host.stop();
    },
    [],
  );

  function handleConnected(next: TuiConfig): void {
    void saveConfig(next);
    setConfig(next);
    setTangle(new TangleRestClient(next.apiUrl, authFetch(next.apiUrl)));
    setError(null);
    setPhase("projects");
  }

  async function openProject(project: Project): Promise<void> {
    if (!tangle) return;
    setError(null);
    setStatus(`Opening ${project.name}…`);
    setPhase("opening");
    try {
      const resolved = project.workspaceId
        ? project
        : await tangle.getProject(project.id);
      if (!resolved.workspaceId) {
        throw new Error("This project has no workspace to connect to.");
      }
      const workspace = await tangle.getWorkspace(resolved.workspaceId);
      const shellUrl = tangentBaseUrlOf(workspace);
      if (!shellUrl) {
        throw new Error("This project's workspace has no Tangent Shell URL.");
      }
      const shell = new ShellClient(shellUrl, authFetch(shellUrl));
      const userEmail = await tangle
        .getCurrentUserEmail()
        .catch(() => undefined);
      setStatus(`Connecting local agent host to ${shellUrl}…`);
      const host = await startLocalAgentHost({
        shellUrl,
        projectId: resolved.id,
        cwd: process.cwd(),
        email: userEmail,
        log: () => {},
      });
      setActive({ project: resolved, shellUrl, shell, host, userEmail });
      setPhase("sessions");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("projects");
    }
  }

  async function openSession(nextSessionId: string): Promise<void> {
    if (!active) return;
    setError(null);
    setStatus("Joining session…");
    setPhase("opening");
    try {
      const cookie = await ensureCookie(active.shellUrl);
      const client = new ChatClient({
        shellUrl: active.shellUrl,
        sessionId: nextSessionId,
        ...(cookie ? { cookie } : {}),
        ...(active.userEmail
          ? {
              authToken: createUnsignedJwt({ email: active.userEmail }),
              userEmail: active.userEmail,
            }
          : {}),
      });
      setSessionId(nextSessionId);
      setChat(client);
      setPhase("chat");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("sessions");
    }
  }

  async function startSession(name?: string): Promise<void> {
    if (!active || !tangle) return;
    setError(null);
    setStatus("Starting a session…");
    setPhase("opening");
    try {
      const newSessionId = await startProjectSession({
        tangle,
        shell: active.shell,
        project: active.project,
        ...(name ? { name } : {}),
      });
      await openSession(newSessionId);
    } catch (err) {
      setError(errorMessage(err));
      setPhase("sessions");
    }
  }

  function goToSessions(): void {
    chat?.dispose();
    setChat(null);
    setSessionId(null);
    setError(null);
    setPhase("sessions");
  }

  async function reset(): Promise<void> {
    chat?.dispose();
    active?.host.stop();
    await resetConnection();
    setChat(null);
    setSessionId(null);
    setActive(null);
    setTangle(null);
    setConfig(null);
    setError(null);
    setPhase("connect");
  }

  if (phase === "connect" || !config || !tangle) {
    return <ConnectScreen onConnected={handleConnected} />;
  }

  if (phase === "projects") {
    return (
      <Box flexDirection="column">
        {error ? (
          <Box paddingX={1}>
            <Text color="red">{error}</Text>
          </Box>
        ) : null}
        <ProjectScreen
          tangle={tangle}
          onOpen={(project) => void openProject(project)}
        />
      </Box>
    );
  }

  if (phase === "opening") {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>{status}</Text>
      </Box>
    );
  }

  if (phase === "sessions" && active) {
    return (
      <Box flexDirection="column">
        {error ? (
          <Box paddingX={1}>
            <Text color="red">{error}</Text>
          </Box>
        ) : null}
        <SessionScreen
          active={active}
          onOpen={(id) => void openSession(id)}
          onStart={(name) => void startSession(name)}
        />
      </Box>
    );
  }

  if (phase === "chat" && active && chat && sessionId) {
    return (
      <ChatScreen
        config={config}
        tangle={tangle}
        active={active}
        sessionId={sessionId}
        chat={chat}
        goToSessions={goToSessions}
        reset={reset}
      />
    );
  }

  return (
    <Box paddingX={1}>
      <Text dimColor>Loading…</Text>
    </Box>
  );
}

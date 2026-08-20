import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { useTangentSettings } from "@/hooks/useTangentSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { useTheme } from "@/providers/ThemeProvider";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/shared/tangent/constants";
import {
  TangentEmbedProvider,
  useTangent,
} from "@/routes/v2/shared/tangent/TangentEmbedProvider";

import { TangentSessionWorkspace } from "./TangentSessionWorkspace";

function TangentChatSession() {
  const { newSession } = useTangent();
  const notify = useToastNotification();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  async function startSession() {
    const trimmed = prompt.trim();
    if (!trimmed || isStarting) return;

    setIsStarting(true);
    try {
      const result = await newSession(trimmed, TANGENT_BUNDLE_ID);
      setSessionId(result.sessionId);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Failed to start Tangent session",
        "error",
      );
    } finally {
      setIsStarting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void startSession();
    }
  }

  if (sessionId) {
    return <TangentSessionWorkspace sessionId={sessionId} />;
  }

  return (
    <BlockStack fill gap="3" className="p-4">
      <BlockStack gap="1" align="center">
        <Text as="h3" size="md" weight="semibold">
          Start a Tangent session
        </Text>
        <Text size="sm" tone="subdued">
          Describe what you want to build and Tangent will get started.
        </Text>
      </BlockStack>
      <Textarea
        className="w-full resize-none max-h-40 overflow-y-auto"
        rows={3}
        placeholder="Draft a pipeline that ingests orders and flags anomalies."
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isStarting}
      />
      <Button onClick={startSession} disabled={isStarting || !prompt.trim()}>
        <Icon name={isStarting ? "Loader" : "Send"} />
        New session
      </Button>
    </BlockStack>
  );
}

export function TangentChatWindow() {
  const { theme } = useTheme();
  const { baseUrl } = useTangentSettings();

  // No `getToken`: the Tangent instance derives its user from an Oktasso JWT
  // cookie on its own origin, not a bearer token, so tangle-ui's JWT is
  // irrelevant here. In local dev the cookie is absent and `GET /api/me`
  // returns 401; the embedded UI falls back to a default identity and the
  // chat/session APIs still work. Wire a real token getter here only for a
  // cross-origin production deployment that verifies bearer auth.
  return (
    <TangentEmbedProvider key={baseUrl} baseUrl={baseUrl} colorScheme={theme}>
      <BlockStack fill align="stretch" inlineAlign="start">
        <TangentChatSession />
      </BlockStack>
    </TangentEmbedProvider>
  );
}

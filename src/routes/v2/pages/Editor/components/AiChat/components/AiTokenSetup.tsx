import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { setAiToken } from "@/agent/aiTokenStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { AiAssistantTokenQueryKeys } from "@/routes/v2/pages/Editor/components/AiChat/types";

export function AiTokenSetup() {
  const [value, setValue] = useState("");
  const queryClient = useQueryClient();
  const { mutate: setAiTokenMutation, isPending: isSettingAiToken } =
    useMutation({
      mutationFn: setAiToken,
      onSuccess: (_data: void, token: string) => {
        queryClient.setQueryData(AiAssistantTokenQueryKeys.Token(), token);
        setValue("");
      },
    });
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !isSettingAiToken;

  function handleSave() {
    if (!canSave) return;
    setAiTokenMutation(trimmed);
  }

  return (
    <BlockStack className="h-full p-4" gap="3" align="start">
      <Text as="h3" size="md" weight="semibold">
        Connect the AI assistant
      </Text>
      <Text as="p" size="sm" tone="subdued">
        Paste your LLM proxy token to enable the assistant. It stays in this
        browser only.
      </Text>
      <Input
        type="password"
        autoComplete="off"
        placeholder="Proxy token"
        aria-label="LLM proxy token"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onEnter={handleSave}
      />
      <Button size="sm" disabled={!canSave} onClick={handleSave}>
        Save token
      </Button>
    </BlockStack>
  );
}

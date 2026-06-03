import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { isRecord } from "@/utils/typeGuards";

function readModelIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data
    .map((item) =>
      isRecord(item) && typeof item.id === "string" ? item.id : null,
    )
    .filter((id): id is string => id !== null);
}

/**
 * Shared bring-your-own-provider configuration UI for AI features. Credentials
 * live in localStorage on the user's machine — no shared key is bundled into
 * the app.
 */
export function AgentSettings() {
  const { config, update, clear, isConfigured } = useAiProviderSettings();
  const notify = useToastNotification();

  const [apiBase, setApiBase] = useState(config.apiBase);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const testRunIdRef = useRef(0);

  const getTrimmedConfig = () => ({
    apiBase: apiBase.trim().replace(/\/+$/, ""),
    apiKey: apiKey.trim(),
    model: model.trim(),
  });

  const validateRequiredFields = () => {
    const trimmed = getTrimmedConfig();
    if (!trimmed.apiBase) {
      setValidationError("Enter an API base URL before continuing.");
      return null;
    }
    setValidationError(null);
    return trimmed;
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = validateRequiredFields();
    if (!trimmed) return;

    setApiBase(trimmed.apiBase);
    setApiKey(trimmed.apiKey);
    setModel(trimmed.model);
    update(trimmed);
    notify("AI provider settings saved", "success");
  };

  const handleClear = () => {
    testRunIdRef.current += 1;
    clear();
    setApiBase("");
    setApiKey("");
    setModel("");
    setValidationError(null);
    setShowKey(false);
    setTesting(false);
    notify("AI provider settings cleared", "success");
  };

  const handleTest = async () => {
    if (testing) return;

    const trimmed = validateRequiredFields();
    if (!trimmed) return;

    const testRunId = testRunIdRef.current + 1;
    testRunIdRef.current = testRunId;
    const isCurrentTest = () => testRunIdRef.current === testRunId;

    setTesting(true);
    try {
      const response = await fetch(`${trimmed.apiBase}/models`, {
        headers: trimmed.apiKey
          ? { authorization: `Bearer ${trimmed.apiKey}` }
          : undefined,
      });
      if (!isCurrentTest()) return;
      if (!response.ok) {
        notify(
          `Test failed: ${response.status} ${response.statusText}`,
          "error",
        );
        return;
      }

      const modelIds = readModelIds(await response.json());
      if (!isCurrentTest()) return;
      if (trimmed.model && !modelIds.includes(trimmed.model)) {
        notify(
          `Connected, but model “${trimmed.model}” was not found.`,
          "error",
        );
        return;
      }
      notify(
        trimmed.model
          ? `Connected. Model “${trimmed.model}” is available.`
          : "Connected. The provider is reachable.",
        "success",
      );
    } catch (err) {
      if (!isCurrentTest()) return;
      notify(
        err instanceof Error ? `Test failed: ${err.message}` : "Test failed",
        "error",
      );
    } finally {
      if (isCurrentTest()) setTesting(false);
    }
  };

  return (
    <BlockStack gap="6">
      <BlockStack gap="2">
        <Heading level={2}>AI Provider Settings</Heading>
        <Paragraph size="sm" tone="subdued">
          AI features use an OpenAI-compatible API of your choice. Your key is
          stored in this browser only and is sent only to the configured
          provider.
        </Paragraph>
        <Paragraph size="xs" tone="subdued">
          {isConfigured
            ? "Status: configured ✅"
            : "Status: not configured. AI features are disabled until you save a provider."}
        </Paragraph>
      </BlockStack>

      <Separator />

      <form onSubmit={handleSave}>
        <BlockStack gap="4">
          <BlockStack gap="1">
            <Label htmlFor="agent-settings-api-base">API base URL</Label>
            <Input
              id="agent-settings-api-base"
              type="url"
              placeholder="https://api.openai.com/v1"
              value={apiBase}
              onChange={(e) => {
                setApiBase(e.target.value);
                setValidationError(null);
              }}
              aria-label="API base URL"
              aria-describedby="agent-settings-api-base-hint"
              autoComplete="off"
            />
            <Text id="agent-settings-api-base-hint" size="xs" tone="subdued">
              Any OpenAI-compatible base URL, such as https://api.openai.com/v1.
              Do not include /chat/completions.
            </Text>
          </BlockStack>

          <BlockStack gap="1">
            <Label htmlFor="agent-settings-api-key">API key</Label>
            <InlineStack gap="2" blockAlign="center" wrap="nowrap">
              <Input
                id="agent-settings-api-key"
                type={showKey ? "text" : "password"}
                placeholder="sk-… or provider-specific token"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setValidationError(null);
                }}
                aria-label="API key"
                aria-describedby="agent-settings-api-key-hint"
                autoComplete="off"
                spellCheck={false}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                <Icon name={showKey ? "EyeOff" : "Eye"} size="sm" />
              </Button>
            </InlineStack>
            <Text id="agent-settings-api-key-hint" size="xs" tone="subdued">
              Optional. Stored in browser localStorage. Leave blank when your
              proxy handles authentication.
            </Text>
          </BlockStack>

          <BlockStack gap="1">
            <Label htmlFor="agent-settings-model">Model</Label>
            <Input
              id="agent-settings-model"
              type="text"
              placeholder="e.g. gpt-4o-mini, gemini-2.5-flash, claude-3-5-haiku"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setValidationError(null);
              }}
              aria-label="Model id"
              aria-describedby="agent-settings-model-hint"
              autoComplete="off"
              spellCheck={false}
            />
            <Text id="agent-settings-model-hint" size="xs" tone="subdued">
              Optional. Model id sent to the provider for AI requests. Leave
              blank to use the default model.
            </Text>
          </BlockStack>

          {validationError && (
            <Text size="xs" tone="critical" role="alert">
              {validationError}
            </Text>
          )}

          <InlineStack gap="2">
            <Button type="submit">Save</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClear}>
              Clear
            </Button>
          </InlineStack>
        </BlockStack>
      </form>
    </BlockStack>
  );
}

import { type FormEvent, useEffect, useRef, useState } from "react";

import { AiModelPicker } from "@/components/shared/Settings/AiModelPicker";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { getAiMaxOutputTokens } from "@/config/aiConfig";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import type { AiProviderConfig } from "@/types/aiProvider";

export function AgentSettings() {
  const {
    config,
    customConfig,
    useOwnKey,
    setUseOwnKey,
    update,
    clear,
    isConfigured,
  } = useAiProviderSettings();
  const notify = useToastNotification();

  const [apiBase, setApiBase] = useState(customConfig.apiBase);
  const [apiKey, setApiKey] = useState(customConfig.apiKey);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const testPendingRef = useRef(false);
  const testRunIdRef = useRef(0);
  const testConfig: AiProviderConfig = useOwnKey
    ? {
        apiBase: apiBase.trim().replace(/\/+$/, ""),
        apiKey: apiKey.trim(),
        model: config.model,
        reasoningEffort: config.reasoningEffort,
      }
    : config;
  const unconfiguredStatus = useOwnKey
    ? "Status: not configured. AI features are disabled until you save a provider."
    : "Status: not configured. Select a backend in Settings → Backend to use its AI proxy.";
  const submitLabel = useOwnKey ? "Save and test AI" : "Test AI";

  useEffect(() => {
    testRunIdRef.current += 1;
    setValidationError(null);
  }, [
    testConfig.apiBase,
    testConfig.apiKey,
    testConfig.credentials,
    testConfig.model,
    testConfig.reasoningEffort,
    useOwnKey,
  ]);

  const handleUseOwnKeyChange = (enabled: boolean) => {
    testRunIdRef.current += 1;
    setShowKey(false);
    setUseOwnKey(enabled);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (testPendingRef.current) return;

    const trimmed = testConfig;
    if (!trimmed.apiBase) {
      setValidationError(
        useOwnKey
          ? "Enter an API base URL before continuing."
          : "Configure a backend in Settings → Backend before testing AI.",
      );
      return;
    }
    setValidationError(null);

    const testRunId = testRunIdRef.current + 1;
    testRunIdRef.current = testRunId;
    const isCurrentTest = () => testRunIdRef.current === testRunId;

    testPendingRef.current = true;
    setTesting(true);
    try {
      const response = await fetch(`${trimmed.apiBase}/responses`, {
        method: "POST",
        credentials: trimmed.credentials,
        headers: {
          "content-type": "application/json",
          ...(trimmed.apiKey
            ? { authorization: `Bearer ${trimmed.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          ...(trimmed.model ? { model: trimmed.model } : {}),
          ...(trimmed.reasoningEffort
            ? { reasoning: { effort: trimmed.reasoningEffort } }
            : {}),
          instructions:
            "You are testing provider compatibility. Return only JSON.",
          input: 'Return the JSON object {"ok": true}.',
          max_output_tokens: getAiMaxOutputTokens(
            trimmed.model,
            trimmed.reasoningEffort,
            32,
          ),
          text: { format: { type: "json_object" } },
        }),
      });
      if (!isCurrentTest()) return;
      if (!response.ok) {
        // Some misconfigured proxies echo request headers back in error bodies.
        // Redact any bearer token before surfacing the detail in a toast.
        const detail = (await response.text().catch(() => "")).replace(
          /Bearer\s+[\w.\-~+/]+=*/gi,
          "Bearer ***",
        );
        if (!isCurrentTest()) return;
        notify(
          `AI test failed: ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
          "error",
        );
        return;
      }

      if (useOwnKey) {
        setApiBase(trimmed.apiBase);
        setApiKey(trimmed.apiKey);
        update({ apiBase: trimmed.apiBase, apiKey: trimmed.apiKey });
      }
      let successMessage = "Backend AI proxy is working.";
      if (useOwnKey) {
        successMessage = trimmed.model
          ? `AI provider settings saved. Model “${trimmed.model}” works with the Responses API.`
          : "AI provider settings saved. The provider works with the Responses API.";
      }
      notify(successMessage, "success");
    } catch (err) {
      if (!isCurrentTest()) return;
      notify(
        err instanceof Error
          ? `AI test failed: ${err.message}`
          : "AI test failed",
        "error",
      );
    } finally {
      testPendingRef.current = false;
      setTesting(false);
    }
  };

  const handleClear = () => {
    testRunIdRef.current += 1;
    clear();
    setApiBase("");
    setApiKey("");
    setValidationError(null);
    setShowKey(false);
    notify("AI provider settings cleared", "success");
  };

  return (
    <BlockStack gap="6">
      <BlockStack gap="2">
        <Heading level={2}>AI Provider Settings</Heading>
        <Paragraph size="sm" tone="subdued">
          {useOwnKey
            ? "AI features use an OpenAI-compatible API of your choice. Your key is stored in this browser only and is sent only to the configured provider."
            : "AI features use the backend AI proxy. No personal API key is required."}
        </Paragraph>
        <Paragraph size="xs" tone="subdued">
          {isConfigured ? "Status: configured ✅" : unconfiguredStatus}
        </Paragraph>
      </BlockStack>

      <Separator />

      <InlineStack gap="2" blockAlign="center">
        <Switch
          id="agent-settings-use-own-key"
          checked={useOwnKey}
          onCheckedChange={handleUseOwnKeyChange}
        />
        <Label htmlFor="agent-settings-use-own-key">Bring your own key</Label>
      </InlineStack>

      <form onSubmit={handleSave}>
        <BlockStack gap="4">
          {useOwnKey && (
            <>
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
                <Text
                  id="agent-settings-api-base-hint"
                  size="xs"
                  tone="subdued"
                >
                  Any OpenAI-compatible base URL, such as
                  https://api.openai.com/v1. Do not include endpoint paths like
                  /responses.
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
                  Optional if your proxy already handles authentication. Stored
                  in this browser only when provided.
                </Text>
              </BlockStack>
            </>
          )}
          {!useOwnKey && isConfigured && (
            <Paragraph size="sm" tone="subdued">
              Backend AI proxy: {config.apiBase}
            </Paragraph>
          )}

          <BlockStack gap="2">
            <Text size="sm" weight="medium">
              Model and thinking
            </Text>
            <AiModelPicker />
          </BlockStack>

          {validationError && (
            <Text size="xs" tone="critical" role="alert">
              {validationError}
            </Text>
          )}

          <InlineStack gap="2">
            <Button type="submit" disabled={testing}>
              {testing ? "Testing…" : submitLabel}
            </Button>
            {useOwnKey && (
              <Button type="button" variant="ghost" onClick={handleClear}>
                Clear
              </Button>
            )}
          </InlineStack>
        </BlockStack>
      </form>
    </BlockStack>
  );
}

import { type FormEvent, useEffect, useRef, useState } from "react";

import { AiModelSelect } from "@/components/shared/AiModelSelect/AiModelSelect";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { getDefaultAiModelId } from "@/config/aiModels";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { isTangleAiProxyBaseUrl } from "@/utils/aiProxy";

export function AgentSettings() {
  const {
    manualConfig: config,
    updateManualConfig,
    clear,
    isConfigured,
    isManuallyConfigured,
    setManuallyConfigured,
  } = useAiProviderSettings();
  const notify = useToastNotification();

  const [apiBase, setApiBase] = useState(config.apiBase);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const testRunIdRef = useRef(0);
  const defaultModelId = getDefaultAiModelId();

  useEffect(() => {
    setModel(config.model);
  }, [config.model]);

  const getTrimmedConfig = () => ({
    apiBase: apiBase.trim().replace(/\/+$/, ""),
    apiKey: apiKey.trim(),
    model: model.trim(),
  });

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    setValidationError(null);
    updateManualConfig({ model: nextModel.trim() });
  };

  const validateRequiredFields = () => {
    const trimmed = getTrimmedConfig();
    if (!trimmed.apiBase) {
      setValidationError("Enter an API base URL before continuing.");
      return null;
    }
    setValidationError(null);
    return trimmed;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (testing) return;

    const trimmed = validateRequiredFields();
    if (!trimmed) return;

    const testRunId = testRunIdRef.current + 1;
    testRunIdRef.current = testRunId;
    const isCurrentTest = () => testRunIdRef.current === testRunId;

    setTesting(true);
    try {
      const response = await fetch(`${trimmed.apiBase}/responses`, {
        method: "POST",
        ...(isTangleAiProxyBaseUrl(trimmed.apiBase)
          ? { credentials: "include" }
          : {}),
        headers: {
          "content-type": "application/json",
          ...(trimmed.apiKey
            ? { authorization: `Bearer ${trimmed.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          ...(trimmed.model ? { model: trimmed.model } : {}),
          max_output_tokens: 32,
          instructions:
            "You are testing provider compatibility. Return only JSON.",
          input: 'Return the JSON object {"ok": true}.',
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

      setApiBase(trimmed.apiBase);
      setApiKey(trimmed.apiKey);
      setModel(trimmed.model);
      updateManualConfig(trimmed);
      notify(
        trimmed.model
          ? `AI provider settings saved. Model “${trimmed.model}” works with the Responses API.`
          : "AI provider settings saved. The provider works with the Responses API.",
        "success",
      );
    } catch (err) {
      if (!isCurrentTest()) return;
      notify(
        err instanceof Error
          ? `AI test failed: ${err.message}`
          : "AI test failed",
        "error",
      );
    } finally {
      if (isCurrentTest()) setTesting(false);
    }
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

  const handleManualConfigurationChange = (enabled: boolean) => {
    testRunIdRef.current += 1;
    setTesting(false);
    setValidationError(null);
    setManuallyConfigured(enabled);
  };

  return (
    <BlockStack gap="6">
      <BlockStack gap="2">
        <Heading level={2}>AI Provider Settings</Heading>
        <Paragraph size="sm" tone="subdued">
          AI features use the connected Tangle backend by default. Turn on
          manual configuration to use another OpenAI-compatible provider.
        </Paragraph>
        <Paragraph size="xs" tone="subdued">
          {isManuallyConfigured
            ? isConfigured
              ? "Status: using a manually configured provider."
              : "Status: enter a proxy URL."
            : isConfigured
              ? "Status: using the Tangle backend."
              : "Status: connect a Tangle backend to use AI."}
        </Paragraph>
      </BlockStack>

      <Separator />

      <BlockStack gap="2">
        <InlineStack gap="2" blockAlign="center">
          <Switch
            id="agent-settings-manual-configuration"
            checked={isManuallyConfigured}
            onCheckedChange={handleManualConfigurationChange}
            aria-describedby="agent-settings-manual-configuration-hint"
          />
          <Label htmlFor="agent-settings-manual-configuration">
            Manually configured
          </Label>
        </InlineStack>
        <Text
          id="agent-settings-manual-configuration-hint"
          size="xs"
          tone="subdued"
        >
          When off, AI requests use the connected Tangle backend. No proxy URL,
          API key, or model setup is needed.
        </Text>
      </BlockStack>

      <form onSubmit={handleSave} hidden={!isManuallyConfigured}>
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
              Do not include endpoint paths like /responses.
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
              Optional if your proxy already handles authentication. Stored in
              this browser only when provided.
            </Text>
          </BlockStack>

          <BlockStack gap="1">
            <Label htmlFor="agent-settings-model">Model</Label>
            <InlineStack gap="2" className="w-full">
              <AiModelSelect
                value={model}
                onValueChange={handleModelChange}
                allowProviderDefault
                ariaLabel="Select a model"
              />
              <Input
                id="agent-settings-model"
                type="text"
                placeholder={`e.g. ${defaultModelId}`}
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                aria-label="Model id"
                aria-describedby="agent-settings-model-hint"
                autoComplete="off"
                spellCheck={false}
                className="h-10 min-w-0 flex-1 basis-48"
              />
            </InlineStack>
            <Text id="agent-settings-model-hint" size="xs" tone="subdued">
              Optional if your provider selects a model. Otherwise, select or
              enter a model ID supported by your provider.
            </Text>
          </BlockStack>

          {validationError && (
            <Text size="xs" tone="critical" role="alert">
              {validationError}
            </Text>
          )}

          <InlineStack gap="2">
            <Button type="submit" disabled={testing}>
              {testing ? "Testing…" : "Save and test AI"}
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

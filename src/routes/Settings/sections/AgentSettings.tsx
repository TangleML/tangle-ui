import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useComponentSearchSettings } from "@/hooks/useComponentSearchSettings";
import useToastNotification from "@/hooks/useToastNotification";

/**
 * Bring-your-own-key configuration UI for in-app agent features (currently
 * the Components V2 natural-language search; more to come). Credentials live
 * in localStorage on the user's machine — no shared key is bundled into the
 * app.
 */
export function AgentSettings() {
  const { config, update, clear, isConfigured } = useComponentSearchSettings();
  const notify = useToastNotification();

  const [apiBase, setApiBase] = useState(config.apiBase);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const [modelError, setModelError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  // Keep the form in sync if `config` changes externally (other tab, etc.).
  // We snapshot the saved values and rehydrate the inputs whenever they
  // differ — not on every render — so the user can keep editing.
  const savedRef = useRef({
    apiBase: config.apiBase,
    apiKey: config.apiKey,
    model: config.model,
  });
  useEffect(() => {
    if (
      savedRef.current.apiBase !== config.apiBase ||
      savedRef.current.apiKey !== config.apiKey ||
      savedRef.current.model !== config.model
    ) {
      savedRef.current = {
        apiBase: config.apiBase,
        apiKey: config.apiKey,
        model: config.model,
      };
      setApiBase(config.apiBase);
      setApiKey(config.apiKey);
      setModel(config.model);
      setModelError(null);
    }
  }, [config.apiBase, config.apiKey, config.model]);

  // Abort in-flight test connections if the user navigates away.
  const testAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      testAbortRef.current?.abort();
    };
  }, []);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedBase = apiBase.trim();
    const trimmedKey = apiKey.trim();
    const trimmedModel = model.trim();
    // Reflect the trimmed values back into the inputs so what the user sees
    // matches what's stored.
    setApiBase(trimmedBase);
    setApiKey(trimmedKey);
    setModel(trimmedModel);

    if (!trimmedModel) {
      setModelError("Enter a model id before saving.");
      return;
    }

    setModelError(null);
    update({
      apiBase: trimmedBase,
      apiKey: trimmedKey,
      model: trimmedModel,
    });
    notify("Agent settings saved", "success");
  };

  const handleClear = () => {
    clear();
    setApiBase("");
    setApiKey("");
    setModel("");
    setModelError(null);
    setShowKey(false);
    notify("Agent settings cleared", "success");
  };

  const handleTest = async () => {
    const trimmedBase = apiBase.trim().replace(/\/+$/, "");
    const trimmedKey = apiKey.trim();
    if (!trimmedBase || !trimmedKey) {
      notify("Enter an API base URL and key first", "error");
      return;
    }
    // Cancel any prior in-flight test before starting a new one.
    testAbortRef.current?.abort();
    const controller = new AbortController();
    testAbortRef.current = controller;
    setTesting(true);
    try {
      const response = await fetch(`${trimmedBase}/models`, {
        headers: { authorization: `Bearer ${trimmedKey}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        notify(
          `Test failed: ${response.status} ${response.statusText}`,
          "error",
        );
        return;
      }
      const payload = (await response.json()) as { data?: unknown[] };
      const count = Array.isArray(payload.data) ? payload.data.length : 0;
      notify(`Connected. Provider exposes ${count} model(s).`, "success");
    } catch (err) {
      if (controller.signal.aborted) return; // user navigated away
      notify(
        err instanceof Error ? `Test failed: ${err.message}` : "Test failed",
        "error",
      );
    } finally {
      if (testAbortRef.current === controller) {
        testAbortRef.current = null;
      }
      setTesting(false);
    }
  };

  return (
    <BlockStack gap="6">
      <BlockStack gap="2">
        <Heading level={2}>Agent Configuration</Heading>
        <Paragraph size="sm" tone="subdued">
          In-app agent features (such as Components V2 natural-language search)
          use an OpenAI-compatible API of your choice. Your key is stored in
          this browser only — it is never sent to Tangle servers.
        </Paragraph>
        <Paragraph size="xs" tone="subdued">
          {isConfigured
            ? "Status: configured ✅"
            : "Status: not configured. Search is disabled until you save credentials."}
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
              onChange={(e) => setApiBase(e.target.value)}
              aria-label="API base URL"
              autoComplete="off"
            />
            <Text size="xs" tone="subdued">
              Any OpenAI-compatible /chat/completions endpoint. Strip the
              trailing slash.
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
                onChange={(e) => setApiKey(e.target.value)}
                aria-label="API key"
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
            <Text size="xs" tone="subdued">
              Stored in browser localStorage. Clear it when sharing this device.
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
                if (modelError) setModelError(null);
              }}
              aria-label="Model id"
              aria-invalid={modelError ? true : undefined}
              aria-describedby={
                modelError
                  ? "agent-settings-model-error agent-settings-model-hint"
                  : "agent-settings-model-hint"
              }
              autoComplete="off"
              spellCheck={false}
            />
            {modelError && (
              <Text id="agent-settings-model-error" size="xs" tone="critical">
                {modelError}
              </Text>
            )}
            <Text id="agent-settings-model-hint" size="xs" tone="subdued">
              Model id sent to the provider for AI search reranking. Must be
              available on the provider above.
            </Text>
          </BlockStack>

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
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              disabled={!isConfigured}
            >
              Clear
            </Button>
          </InlineStack>
        </BlockStack>
      </form>
    </BlockStack>
  );
}

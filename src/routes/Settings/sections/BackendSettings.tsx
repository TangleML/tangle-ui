import { type ChangeEvent, useEffect, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { API_URL } from "@/utils/constants";

export function BackendSettings() {
  const notify = useToastNotification();
  const {
    backendUrl,
    available,
    isConfiguredFromEnv,
    isConfiguredFromRelativePath,
    ping,
    setEnvConfig,
    setRelativePathConfig,
    setBackendUrl,
  } = useBackend();

  const [inputBackendUrl, setInputBackendUrl] = useState(
    isConfiguredFromEnv ? "" : backendUrl,
  );
  const [inputBackendTestResult, setInputBackendTestResult] = useState<
    boolean | null
  >(null);
  const [isEnvConfig, setIsEnvConfig] = useState(isConfiguredFromEnv);
  const [isRelativePathConfig, setIsRelativePathConfig] = useState(
    isConfiguredFromRelativePath,
  );

  const hasEnvConfig = !!API_URL;
  const showRelativePathOption = !API_URL;

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputBackendUrl(e.target.value);
    setInputBackendTestResult(null);
  };

  const handleRefresh = () => {
    ping({});
  };

  const handleTest = async () => {
    const result = await ping({
      url: inputBackendUrl,
      notifyResult: true,
      saveAvailability: false,
    });
    setInputBackendTestResult(result);
  };

  const handleEnvSwitch = (checked: boolean) => {
    setIsEnvConfig(checked);
    if (checked) setIsRelativePathConfig(false);
  };

  const handleSave = () => {
    setEnvConfig(isEnvConfig);
    setRelativePathConfig(isRelativePathConfig);
    setBackendUrl(inputBackendUrl);
    setInputBackendUrl(inputBackendUrl.trim());
    setInputBackendTestResult(null);
    notify("Backend configuration saved", "success");
  };

  useEffect(() => {
    setIsEnvConfig(isConfiguredFromEnv);
    setIsRelativePathConfig(isConfiguredFromRelativePath);
  }, [isConfiguredFromEnv, isConfiguredFromRelativePath]);

  useEffect(() => {
    setInputBackendUrl(
      isConfiguredFromEnv || isConfiguredFromRelativePath ? "" : backendUrl,
    );
  }, [isConfiguredFromEnv, isConfiguredFromRelativePath, backendUrl]);

  const hasBackendConfigured =
    !!inputBackendUrl.trim() ||
    (isEnvConfig && hasEnvConfig) ||
    isRelativePathConfig;
  const saveButtonText = hasBackendConfigured
    ? "Save"
    : "Continue without backend";

  return (
    <BlockStack gap="4">
      <BlockStack gap="2">
        <Heading level={2}>Backend Configuration</Heading>
        <Paragraph tone="subdued" size="sm">
          Configure the connection to your Tangle backend server.
        </Paragraph>
      </BlockStack>

      <Separator />

      <InlineStack gap="2" blockAlign="center">
        <Paragraph>Backend status:</Paragraph>
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-2" tabIndex={-1}>
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                available ? "bg-success" : "bg-destructive",
              )}
            />
            <Paragraph weight="light" size="xs" className="italic">
              {available ? "available" : "unavailable"}
            </Paragraph>
          </TooltipTrigger>
          <TooltipContent>
            {isConfiguredFromEnv && hasEnvConfig
              ? "Configured from .env"
              : backendUrl.length > 0
                ? `Configured to ${backendUrl}`
                : isConfiguredFromRelativePath
                  ? "Configured relative to host domain"
                  : "No backend configured"}
          </TooltipContent>
        </Tooltip>
        <Button onClick={handleRefresh} size="icon" variant="ghost">
          <Icon name="RefreshCcw" />
        </Button>
      </InlineStack>

      {hasEnvConfig && (
        <>
          <Separator />
          <BlockStack gap="2">
            <Heading level={3}>Configure using .env</Heading>
            <InlineStack gap="2">
              <Switch checked={isEnvConfig} onCheckedChange={handleEnvSwitch} />
              <Paragraph>
                Use backend url configuration from environment file.
              </Paragraph>
            </InlineStack>
          </BlockStack>
        </>
      )}

      {showRelativePathOption && (
        <>
          <Separator />
          <BlockStack gap="2">
            <Heading level={3}>Use same-domain backend</Heading>
            <InlineStack gap="2">
              <Switch
                checked={isRelativePathConfig}
                onCheckedChange={(checked) => {
                  setIsRelativePathConfig(checked);
                  if (checked) setIsEnvConfig(false);
                }}
              />
              <Paragraph>
                Use backend configuration relative to the current domain.
              </Paragraph>
            </InlineStack>
            {isRelativePathConfig && (
              <Paragraph weight="light" size="xs" className="italic">
                Backend requests will be made to {window.location.origin}
                /api.
              </Paragraph>
            )}
          </BlockStack>
        </>
      )}

      {!(isEnvConfig && hasEnvConfig) && !isRelativePathConfig && (
        <>
          <Separator />
          <InfoBox title="Manual Configuration">
            You can set the backend URL in the environment file or use the input
            below.
          </InfoBox>
          <BlockStack gap="2">
            <Heading level={3}>Backend URL</Heading>
            <InlineStack gap="2" wrap="nowrap" className="w-full">
              <InlineStack className="relative w-full">
                <Input
                  value={inputBackendUrl}
                  placeholder="http://localhost:8000"
                  onChange={handleInputChange}
                  className={inputBackendTestResult !== null ? "pr-10" : ""}
                />
                {inputBackendTestResult !== null && (
                  <Tooltip>
                    <TooltipTrigger
                      className={cn(
                        "absolute right-2 flex items-center h-full text-lg",
                        inputBackendTestResult
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {inputBackendTestResult ? "✓" : "✗"}
                    </TooltipTrigger>
                    <TooltipContent>
                      {inputBackendTestResult
                        ? "Backend responded"
                        : "No response"}
                    </TooltipContent>
                  </Tooltip>
                )}
              </InlineStack>

              <Button variant="secondary" onClick={handleTest}>
                <Icon name="DatabaseZap" />
                Test
              </Button>
            </InlineStack>
          </BlockStack>
          {!inputBackendUrl.trim() && (
            <InlineStack gap="2">
              <Icon
                name="CircleAlert"
                className="inline-block text-destructive"
              />
              <Paragraph tone="critical" size="sm">
                No backend is configured. Certain features may not be operable.
              </Paragraph>
            </InlineStack>
          )}
        </>
      )}

      <Separator />

      <InlineStack align="end">
        <Button onClick={handleSave}>{saveButtonText}</Button>
      </InlineStack>
    </BlockStack>
  );
}

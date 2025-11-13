import { type ChangeEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";
import { API_URL } from "@/utils/constants";

import { InfoBox } from "../InfoBox";

interface BackendConfigurationDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const BackendConfigurationDialog = ({
  open,
  setOpen,
}: BackendConfigurationDialogProps) => {
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

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputBackendUrl(e.target.value);
    setInputBackendTestResult(null);
  }, []);

  const handleRefresh = useCallback(() => {
    ping({});
  }, [ping]);

  const handleTest = useCallback(async () => {
    const result = await ping({
      url: inputBackendUrl,
      notifyResult: true,
      saveAvailability: false,
    });
    setInputBackendTestResult(result);
  }, [inputBackendUrl, ping]);

  const handleEnvSwitch = useCallback((checked: boolean) => {
    setIsEnvConfig(checked);
    if (checked) setIsRelativePathConfig(false);
  }, []);

  const handleConfirm = useCallback(() => {
    setEnvConfig(isEnvConfig);
    setRelativePathConfig(isRelativePathConfig);
    setBackendUrl(inputBackendUrl);
    setInputBackendUrl(inputBackendUrl.trim());
    setInputBackendTestResult(null);
    setOpen(false);
  }, [
    isEnvConfig,
    isRelativePathConfig,
    inputBackendUrl,
    setEnvConfig,
    setRelativePathConfig,
    setBackendUrl,
    setOpen,
  ]);

  const handleClose = useCallback(() => {
    setIsEnvConfig(isConfiguredFromEnv);
    setIsRelativePathConfig(isConfiguredFromRelativePath);
    setInputBackendUrl("");
    setInputBackendTestResult(null);
    setOpen(false);
  }, [isConfiguredFromEnv, isConfiguredFromRelativePath, setOpen]);

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
  const confirmButtonText = hasBackendConfigured
    ? "Confirm"
    : "Continue without backend";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Configure Backend</DialogTitle>
        </DialogHeader>

        <DialogDescription>
          Attach the Tangle frontend to a custom backend.
        </DialogDescription>

        <BlockStack gap="4">
          <InlineStack gap="2" blockAlign="center">
            <Paragraph>Backend status: </Paragraph>
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
                <Heading level={1}>Configure using .env</Heading>
                <InlineStack gap="2" blockAlign="center">
                  <Switch
                    checked={isEnvConfig}
                    onCheckedChange={handleEnvSwitch}
                  />
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
                <Heading level={1}>Use same-domain backend</Heading>
                <InlineStack gap="2" blockAlign="center">
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
                You can set the backend URL in the environment file or use the
                input below.
              </InfoBox>
              <BlockStack>
                <Heading level={3}>Backend URL</Heading>
                <InlineStack
                  gap="2"
                  blockAlign="center"
                  wrap="nowrap"
                  className="w-full"
                >
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
                <InlineStack gap="2" blockAlign="center">
                  <Icon
                    name="CircleAlert"
                    className="inline-block text-destructive"
                  />
                  <Paragraph tone="critical" size="sm">
                    No backend is configured. Certain features may not be
                    operable.
                  </Paragraph>
                </InlineStack>
              )}
            </>
          )}
        </BlockStack>
        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>{confirmButtonText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackendConfigurationDialog;

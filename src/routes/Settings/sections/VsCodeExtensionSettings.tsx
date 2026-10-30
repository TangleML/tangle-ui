import { useEffect, useState } from "react";
import type { Components } from "react-markdown";

import { Markdown } from "@/components/shared/Markdown/Markdown";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { TANGENT_CONFIG } from "@/config/tangentConfiguration";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { CommandBlock } from "@/routes/v2/shared/components/CommandBlock";
import { tracking } from "@/utils/tracking";

interface ExtensionManifest {
  version: string;
  filename: string;
  url: string;
}

function isExtensionManifest(value: unknown): value is ExtensionManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof value.version === "string" &&
    "filename" in value &&
    typeof value.filename === "string" &&
    "url" in value &&
    typeof value.url === "string"
  );
}

const STABLE_VSIX_PATH = "/extension/tangent-local-agent.vsix";
const DEFAULT_VSIX_FILENAME = "tangent-local-agent.vsix";

const INLINE_MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <>{children}</>,
};

export function VsCodeExtensionSettings() {
  const { track } = useAnalytics();
  const [manifest, setManifest] = useState<ExtensionManifest | null>(null);
  const search = window.location.search;

  useEffect(() => {
    track("settings.vscode_extension_impression");
  }, [track]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/extension/latest.json${search}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) {
          setManifest(isExtensionManifest(data) ? data : null);
        }
      })
      .catch(() => {
        if (!cancelled) setManifest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  const origin = window.location.origin;
  const downloadUrl = manifest
    ? `${origin}${manifest.url}${search}`
    : `${STABLE_VSIX_PATH}${search}`;
  const vsixFilename = manifest?.filename ?? DEFAULT_VSIX_FILENAME;

  const { description, steps } = TANGENT_CONFIG.ui.VsCodeExtensionSettings;

  return (
    <BlockStack gap="6">
      <BlockStack gap="3">
        <Heading level={2} weight="semibold">
          VS Code Extension: Manual install and upgrade
        </Heading>
        <Paragraph size="sm" tone="subdued">
          <Markdown
            body={description}
            components={INLINE_MARKDOWN_COMPONENTS}
          />
        </Paragraph>
        <InlineStack gap="2" blockAlign="center">
          <Button
            asChild
            {...tracking("settings.vscode_extension.download_vsix", {
              version: manifest?.version ?? "stable",
            })}
          >
            <a href={downloadUrl} download>
              <Icon name="Download" size="sm" />
              Download .vsix{manifest ? ` (v${manifest.version})` : ""}
            </a>
          </Button>
        </InlineStack>
        <Tabs defaultValue="cursor">
          <TabsList>
            <TabsTrigger
              value="cursor"
              {...tracking("settings.vscode_extension.editor_tab", {
                editor: "cursor",
              })}
            >
              Cursor
            </TabsTrigger>
            <TabsTrigger
              value="vscode"
              {...tracking("settings.vscode_extension.editor_tab", {
                editor: "vscode",
              })}
            >
              Visual Studio Code
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cursor">
            <CommandBlock
              command={`cursor --install-extension ~/Downloads/${vsixFilename}`}
              trackingId="settings.vscode_extension.copy_install_command"
              trackingMetadata={{ editor: "cursor" }}
            />
          </TabsContent>
          <TabsContent value="vscode">
            <CommandBlock
              command={`code --install-extension ~/Downloads/${vsixFilename}`}
              trackingId="settings.vscode_extension.copy_install_command"
              trackingMetadata={{ editor: "vscode" }}
            />
          </TabsContent>
        </Tabs>
        <ol className="list-decimal space-y-1 pl-5">
          {steps.map((step) => (
            <li key={step}>
              <Text size="sm">
                <Markdown body={step} components={INLINE_MARKDOWN_COMPONENTS} />
              </Text>
            </li>
          ))}
        </ol>
      </BlockStack>
    </BlockStack>
  );
}

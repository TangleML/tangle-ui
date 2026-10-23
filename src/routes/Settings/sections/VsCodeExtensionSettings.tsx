import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { CopyValueButton } from "@/routes/v2/shared/components/CopyValueButton";

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

function CommandBlock({ command }: { command: string }) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      wrap="nowrap"
      className="w-full min-w-0 rounded-md border border-border bg-muted px-3 py-2"
    >
      <Text
        size="sm"
        font="mono"
        className="min-w-0 flex-1 overflow-x-auto whitespace-pre"
      >
        {command}
      </Text>
      <CopyValueButton valueFn={() => command} />
    </InlineStack>
  );
}

export function VsCodeExtensionSettings() {
  const [manifest, setManifest] = useState<ExtensionManifest | null>(null);
  const search = window.location.search;

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

  return (
    <BlockStack gap="6">
      <BlockStack gap="3">
        <Heading level={2} weight="semibold">
          VS Code Extension: Manual install and upgrade
        </Heading>
        <Paragraph size="sm" tone="subdued">
          Download the package and install it from the editor. Re-running either
          path always pulls the latest version.
        </Paragraph>
        <InlineStack gap="2" blockAlign="center">
          <Button asChild>
            <a href={downloadUrl} download>
              <Icon name="Download" size="sm" />
              Download .vsix{manifest ? ` (v${manifest.version})` : ""}
            </a>
          </Button>
        </InlineStack>
        <Tabs defaultValue="cursor">
          <TabsList>
            <TabsTrigger value="cursor">Cursor</TabsTrigger>
            <TabsTrigger value="vscode">Visual Studio Code</TabsTrigger>
          </TabsList>
          <TabsContent value="cursor">
            <CommandBlock
              command={`cursor --install-extension ~/Downloads/${vsixFilename}`}
            />
          </TabsContent>
          <TabsContent value="vscode">
            <CommandBlock
              command={`code --install-extension ~/Downloads/${vsixFilename}`}
            />
          </TabsContent>
        </Tabs>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <Text size="sm">Open the Extensions view, then its “…” menu.</Text>
          </li>
          <li>
            <Text size="sm">
              Choose “Install from VSIX…” and pick the downloaded file.
            </Text>
          </li>
          <li>
            <Text size="sm">Reload or restart the editor to activate it.</Text>
          </li>
        </ol>
      </BlockStack>
    </BlockStack>
  );
}

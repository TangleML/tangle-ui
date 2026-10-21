import { useState } from "react";

import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { Paragraph } from "@/components/ui/typography";
import {
  prefersBrowserPipelineStorage,
  setBrowserPipelineStorage,
} from "@/services/pipelineStorage/pipelineCreation";

export function PipelineStorageSetting() {
  const localOnly = import.meta.env.VITE_LOCAL_PIPELINES === "true";
  const [enabled, setEnabled] = useState(
    () => localOnly || prefersBrowserPipelineStorage(),
  );
  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap">
      <Switch
        id="browser-pipeline-storage"
        checked={enabled}
        disabled={localOnly}
        onCheckedChange={(value) => {
          setBrowserPipelineStorage(value);
          setEnabled(value);
        }}
        aria-describedby="browser-pipeline-storage-description"
      />
      <BlockStack>
        <Label htmlFor="browser-pipeline-storage">
          Save new pipelines in this browser
        </Label>
        <Paragraph
          id="browser-pipeline-storage-description"
          size="sm"
          tone="subdued"
        >
          Use browser storage for new pipelines, imports, and copies when your
          backend does not support saving or your account cannot write. Existing
          remote pipelines keep their current location.
        </Paragraph>
      </BlockStack>
    </InlineStack>
  );
}

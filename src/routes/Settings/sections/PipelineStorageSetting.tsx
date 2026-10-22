import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import {
  prefersBrowserPipelineStorage,
  setBrowserPipelineStorage,
} from "@/services/pipelineStorage/pipelineCreation";
import { revokePipelineMigrationConsent } from "@/services/pipelineStorage/pipelineMigrationConsent";

export function PipelineStorageSetting() {
  const { backendUrl } = useBackend();
  const notify = useToastNotification();
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
        <Button
          variant="outline"
          disabled={!backendUrl}
          onClick={() => {
            try {
              revokePipelineMigrationConsent(backendUrl);
              notify(
                "You'll be asked before moving pipelines to this backend.",
                "success",
              );
            } catch {
              notify(
                "Unable to update the browser's migration preference.",
                "error",
              );
            }
          }}
        >
          Ask before moving pipelines to this backend
        </Button>
      </BlockStack>
    </InlineStack>
  );
}

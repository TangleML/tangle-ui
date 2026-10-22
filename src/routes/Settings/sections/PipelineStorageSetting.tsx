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
  remotePipelinesEnabled,
  setBrowserPipelineStorage,
} from "@/services/pipelineStorage/pipelineCreation";
import { revokePipelineMigrationConsent } from "@/services/pipelineStorage/pipelineMigrationConsent";

export function PipelineStorageSetting() {
  const { backendUrl, configured } = useBackend();
  const notify = useToastNotification();
  const localOnly = !remotePipelinesEnabled();
  const [enabled, setEnabled] = useState(() => prefersBrowserPipelineStorage());
  return (
    <InlineStack gap="2" blockAlign="center" wrap="nowrap">
      <Switch
        id="browser-pipeline-storage"
        checked={localOnly || !configured || enabled}
        disabled={localOnly || !configured}
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
          {localOnly
            ? "Remote pipeline storage is not enabled for this deployment. New pipelines, imports, and copies are saved in this browser."
            : !configured
              ? "New pipelines, imports, and copies are saved in this browser until a backend is configured."
              : "Use browser storage for new pipelines, imports, and copies when your backend does not support saving or your account cannot write. Existing remote pipelines keep their current location."}
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

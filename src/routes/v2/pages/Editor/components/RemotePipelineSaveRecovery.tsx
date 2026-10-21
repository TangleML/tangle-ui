import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";

import { PipelineNameDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

import { savePipelineAs } from "./EditorMenuBar/components/fileMenu.actions";

export const RemotePipelineSaveRecovery = observer(
  function RemotePipelineSaveRecovery() {
    const { autoSave, pipelineFile } = useEditorSession();
    const { navigation } = useSharedStores();
    const storage = usePipelineStorage();
    const notify = useToastNotification();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);
    const file = pipelineFile.activePipelineFile;
    if (!autoSave.error || (!file?.remote && !file?.isDraft)) return null;

    async function saveLocalCopy(name: string) {
      if (pending.current) return;
      pending.current = true;
      setSaving(true);
      try {
        const copy = await savePipelineAs(navigation, name, storage, file, {
          backendUrl: undefined,
        });
        if (!copy) throw new Error("No pipeline is open to copy.");
        notify(
          `Saved "${name}" in this browser. Find it under Local Pipelines.`,
          "success",
        );
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "Unable to save a local copy.",
          "error",
        );
      } finally {
        pending.current = false;
        setSaving(false);
      }
    }

    return (
      <BlockStack
        gap="2"
        className="shrink-0 border-b border-destructive/40 bg-card p-3"
      >
        <Paragraph role="alert">
          {autoSave.error} Your changes are kept in this tab. Save a local copy
          before closing it.
        </Paragraph>
        <InlineStack gap="2">
          <Button
            variant="outline"
            disabled={autoSave.isSaving}
            onClick={() => void autoSave.save().catch(() => {})}
          >
            Retry remote save
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => setOpen(true)}
          >
            Save local copy
          </Button>
        </InlineStack>
        <PipelineNameDialog
          open={open}
          onOpenChange={setOpen}
          title="Save local copy"
          description="Save the current pipeline in this browser. The remote pipeline will not be changed by this copy."
          initialName={`${navigation.rootSpec?.name || "Untitled pipeline"} (Local copy)`}
          onSubmit={(name) => void saveLocalCopy(name)}
          submitButtonText="Save local copy"
          isSubmitDisabled={() => saving}
        />
      </BlockStack>
    );
  },
);

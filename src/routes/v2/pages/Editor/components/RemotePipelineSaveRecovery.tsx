import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { exportCurrentPipeline } from "./EditorMenuBar/components/fileMenu.actions";

export const RemotePipelineSaveRecovery = observer(
  function RemotePipelineSaveRecovery() {
    const { autoSave } = useEditorSession();
    const { navigation } = useSharedStores();
    if (!autoSave.error) return null;

    return (
      <BlockStack
        gap="2"
        className="shrink-0 border-b border-destructive/40 bg-card p-3"
      >
        <Paragraph role="alert">
          {autoSave.error} Your changes are kept in this tab. Retry saving or
          export the pipeline before closing it.
        </Paragraph>
        <InlineStack gap="2">
          <Button
            variant="outline"
            disabled={autoSave.isSaving}
            onClick={() => void autoSave.save().catch(() => {})}
          >
            Retry save
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCurrentPipeline(navigation)}
          >
            Export YAML
          </Button>
        </InlineStack>
      </BlockStack>
    );
  },
);

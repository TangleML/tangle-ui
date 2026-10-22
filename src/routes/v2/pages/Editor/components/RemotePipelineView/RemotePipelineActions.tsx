import { useNavigate } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import useToastNotification from "@/hooks/useToastNotification";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { savePipelineAs } from "@/routes/v2/pages/Editor/components/EditorMenuBar/components/fileMenu.actions";
import { ToolsPanel } from "@/routes/v2/shared/components/ToolsPanel";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";

export const RemotePipelineActions = observer(function RemotePipelineActions({
  file,
  layout,
}: {
  file?: PipelineFile;
  layout?: "rail";
}) {
  const { navigation } = useSharedStores();
  const { configured } = useBackend();
  const storage = usePipelineStorage();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const pending = useRef(false);
  const root = navigation.rootSpec;
  if (!root) return null;
  const spec = serializeComponentSpec(root);

  async function clone(name: string) {
    if (!file || pending.current) return;
    pending.current = true;
    setCopying(true);
    try {
      const copy = await savePipelineAs(navigation, name, storage, file);
      if (!copy) throw new Error("No pipeline is open to copy.");
      await navigate(
        copy.remote
          ? {
              to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
              params: { pipelineId: copy.id },
            }
          : {
              to: APP_ROUTES.EDITOR_V2_PIPELINE,
              params: { pipelineName: copy.storageKey },
              search: { fileId: copy.id },
            },
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to clone pipeline.",
        "error",
      );
    } finally {
      pending.current = false;
      setCopying(false);
    }
  }

  return (
    <>
      <ToolsPanel layout={layout}>
        {({ isRail, className, wrapperClassName, tooltipSide }) => (
          <>
            <ViewYamlButton
              componentSpec={spec}
              displayLabel={isRail ? undefined : "View YAML"}
              aria-label="View YAML"
              showTooltip={isRail}
              tooltipSide={tooltipSide}
              className={className}
              wrapperClassName={wrapperClassName}
            />
            {file && (
              <ActionButton
                icon="CopyPlus"
                {...(isRail
                  ? { tooltip: "Clone pipeline" }
                  : { label: "Clone pipeline" })}
                aria-label="Clone pipeline"
                tooltipSide={tooltipSide}
                className={className}
                wrapperClassName={wrapperClassName}
                disabled={copying}
                onClick={() => setOpen(true)}
              />
            )}
          </>
        )}
      </ToolsPanel>
      {file && (
        <PipelineNameDialog
          open={open}
          onOpenChange={setOpen}
          title="Clone pipeline"
          initialName={`${root.name || "Untitled pipeline"} (Copy)`}
          validateLocalName={createsLocalPipelines(configured)}
          onSubmit={(name) => void clone(name)}
          submitButtonText="Clone pipeline"
          isSubmitDisabled={() => copying}
        />
      )}
    </>
  );
});

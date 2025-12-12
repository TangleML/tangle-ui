import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useValidationIssueNavigation } from "@/components/Editor/hooks/useValidationIssueNavigation";
import { CodeViewer } from "@/components/shared/CodeViewer";
import {
  type Action,
  ActionBlock,
} from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "@/components/shared/ContextPanel/Blocks/ListBlock";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { APP_ROUTES } from "@/routes/router";
import {
  getComponentFileFromList,
  renameComponentFileInList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { componentSpecToText } from "@/utils/yaml";

import PipelineIO from "../../shared/Execution/PipelineIO";
import { PipelineValidationList } from "./PipelineValidationList";

const PipelineDetails = () => {
  const notify = useToastNotification();
  const {
    componentSpec,
    digest,
    isComponentTreeValid,
    globalValidationIssues,
    saveComponentSpec,
  } = useComponentSpec();

  const navigate = useNavigate();

  const location = useLocation();
  const pathname = location.pathname;

  const title = componentSpec?.name;

  const { handleIssueClick, groupedIssues } = useValidationIssueNavigation(
    globalValidationIssues,
  );

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isYamlFullscreen, setIsYamlFullscreen] = useState(false);

  // State for file metadata
  const [fileMeta, setFileMeta] = useState<{
    creationTime?: Date;
    modificationTime?: Date;
    createdBy?: string;
  }>({});

  const isSubmitDisabled = (name: string) => {
    return name === title;
  };

  const handleTitleUpdate = async (name: string) => {
    if (!componentSpec) {
      notify("Update failed: ComponentSpec not found", "error");
      return;
    }

    await renameComponentFileInList(
      USER_PIPELINES_LIST_NAME,
      title ?? "",
      name,
      pathname,
    );

    await saveComponentSpec(name);

    const urlName = encodeURIComponent(name);
    const url = APP_ROUTES.PIPELINE_EDITOR.replace("$name", urlName);

    navigate({ to: url });
  };

  // Fetch file metadata on mount or when componentSpec.name changes
  useEffect(() => {
    const fetchMeta = async () => {
      if (!componentSpec.name) return;

      try {
        const file = await getComponentFileFromList(
          USER_PIPELINES_LIST_NAME,
          componentSpec.name,
        );
        if (file) {
          setFileMeta({
            creationTime: file.creationTime,
            modificationTime: file.modificationTime,
            createdBy: file.componentRef.spec.metadata?.annotations?.author,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notify("Failed to fetch file metadata: " + message, "error");
      }
    };
    fetchMeta();
  }, [componentSpec.name]);

  const metadata = [
    {
      label: "Created by",
      value: fileMeta.createdBy,
    },
    {
      label: "Created at",
      value: fileMeta.creationTime?.toLocaleString(),
    },
    {
      label: "Last updated",
      value: fileMeta.modificationTime?.toLocaleString(),
    },
  ];

  const annotations = Object.entries(
    componentSpec.metadata?.annotations || {},
  ).map(([key, value]) => ({ label: key, value: String(value) }));

  const actions: Action[] = [
    {
      label: "Rename Pipeline",
      icon: "PencilLine",
      onClick: () => setIsRenameDialogOpen(true),
    },
    {
      label: "View YAML",
      icon: "FileCodeCorner",
      onClick: () => setIsYamlFullscreen(true),
    },
  ];

  return (
    <>
      <BlockStack
        gap="4"
        className="h-full px-2"
        data-context-panel="pipeline-details"
      >
        <CopyText className="text-lg font-semibold">
          {componentSpec.name ?? "Unnamed Pipeline"}
        </CopyText>

        <ActionBlock actions={actions} />

        <ListBlock items={metadata} marker="none" />

        {componentSpec.description && (
          <TextBlock title="Description" text={componentSpec.description} />
        )}

        {digest && (
          <TextBlock
            title="Digest"
            text={digest}
            copyable
            className="bg-secondary p-2 rounded-md border"
            mono
          />
        )}

        {annotations.length > 0 && (
          <ListBlock title="Annotations" items={annotations} marker="none" />
        )}

        <PipelineIO />

        <ContentBlock title="Validations">
          <PipelineValidationList
            isComponentTreeValid={isComponentTreeValid}
            groupedIssues={groupedIssues}
            totalIssueCount={globalValidationIssues.length}
            onIssueSelect={handleIssueClick}
          />
        </ContentBlock>
      </BlockStack>
      {isYamlFullscreen && (
        <CodeViewer
          code={componentSpecToText(componentSpec)}
          language="yaml"
          filename={componentSpec.name ?? "pipeline.yaml"}
          isFullscreen={isYamlFullscreen}
          onClose={() => setIsYamlFullscreen(false)}
        />
      )}
      <PipelineNameDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        title="Name Pipeline"
        description="Unsaved pipeline changes will be lost."
        initialName={title ?? ""}
        onSubmit={handleTitleUpdate}
        submitButtonText="Update Title"
        isSubmitDisabled={isSubmitDisabled}
      />
    </>
  );
};

export default PipelineDetails;

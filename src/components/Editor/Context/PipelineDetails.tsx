import { useEffect, useState } from "react";

import { useValidationIssueNavigation } from "@/components/Editor/hooks/useValidationIssueNavigation";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { CodeViewer } from "@/components/shared/CodeViewer";
import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "@/components/shared/ContextPanel/Blocks/ListBlock";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { getComponentFileFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { componentSpecToText } from "@/utils/yaml";

import PipelineIO from "../../shared/Execution/PipelineIO";
import { PipelineValidationList } from "./PipelineValidationList";
import RenamePipeline from "./RenamePipeline";

const PipelineDetails = () => {
  const notify = useToastNotification();
  const {
    componentSpec,
    digest,
    isComponentTreeValid,
    globalValidationIssues,
  } = useComponentSpec();

  const { handleIssueClick, groupedIssues } = useValidationIssueNavigation(
    globalValidationIssues,
  );

  const [isYamlFullscreen, setIsYamlFullscreen] = useState(false);

  // State for file metadata
  const [fileMeta, setFileMeta] = useState<{
    creationTime?: Date;
    modificationTime?: Date;
    createdBy?: string;
  }>({});

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

  const actions = [
    <RenamePipeline key="rename-pipeline-action" />,
    <TooltipButton
      variant="outline"
      tooltip="View YAML"
      onClick={() => setIsYamlFullscreen(true)}
      key="view-yaml-action"
    >
      <Icon name="FileCodeCorner" />
    </TooltipButton>,
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
    </>
  );
};

export default PipelineDetails;

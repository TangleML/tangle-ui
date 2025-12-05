import { useEffect, useState } from "react";

import { PipelineValidationList } from "@/components/Editor/Context/PipelineValidationList";
import { useValidationIssueNavigation } from "@/components/Editor/hooks/useValidationIssueNavigation";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { ListBlock } from "@/components/shared/ContextPanel/Blocks/ListBlock";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { TaskImplementation } from "@/components/shared/TaskDetails";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { getComponentFileFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import PipelineIO from "./PipelineIO";
import RenamePipeline from "./RenamePipeline";

const PipelineDetails = () => {
  const {
    componentSpec,
    digest,
    isComponentTreeValid,
    globalValidationIssues,
  } = useComponentSpec();

  const { handleIssueClick, groupedIssues } = useValidationIssueNavigation(
    globalValidationIssues,
  );

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
    };
    fetchMeta();
  }, [componentSpec.name]);

  const metadata = [
    {
      name: "Created by",
      value: fileMeta.createdBy,
    },
    {
      name: "Created at",
      value: fileMeta.creationTime?.toLocaleString(),
    },
    {
      name: "Last updated",
      value: fileMeta.modificationTime?.toLocaleString(),
    },
  ];

  const annotations = Object.entries(
    componentSpec.metadata?.annotations || {},
  ).map(([key, value]) => ({ name: key, value: String(value) }));

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="pipeline-details"
    >
      {/* Header */}
      <InlineStack gap="2" wrap="nowrap" blockAlign="center">
        <Icon name="Network" size="xl" className="rotate-270 min-w-6 min-h-6" />
        <Text size="lg" weight="semibold" data-testid="pipeline-name">
          {componentSpec.name ?? "Unnamed Pipeline"}
        </Text>
        <RenamePipeline />
      </InlineStack>

      <TaskImplementation
        displayName={componentSpec.name ?? "Pipeline"}
        componentSpec={componentSpec}
        showInlineContent={false}
      />

      {/* General Metadata */}
      <ListBlock items={metadata} marker="none" />

      {/* Description */}
      {componentSpec.description && (
        <TextBlock title="Description" text={componentSpec.description} />
      )}

      {/* Component Digest */}
      {digest && <TextBlock title="Digest" text={digest} allowCopy />}

      {/* Annotations */}
      {annotations.length > 0 && (
        <ListBlock title="Annotations" items={annotations} marker="none" />
      )}

      {/* Artifacts (Inputs & Outputs) */}
      <PipelineIO />

      {/* Validations */}
      <ContentBlock title="Validations">
        <PipelineValidationList
          isComponentTreeValid={isComponentTreeValid}
          groupedIssues={groupedIssues}
          totalIssueCount={globalValidationIssues.length}
          onIssueSelect={handleIssueClick}
        />
      </ContentBlock>
    </BlockStack>
  );
};

export default PipelineDetails;

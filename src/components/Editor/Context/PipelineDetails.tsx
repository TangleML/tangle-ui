import { useEffect, useState } from "react";

import { useValidationIssueNavigation } from "@/components/Editor/hooks/useValidationIssueNavigation";
import { ViewYamlButton } from "@/components/shared/Buttons/ViewYamlButton";
import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { PipelineDescription } from "@/components/shared/PipelineDescription/PipelineDescription";
import { PipelineRunNameTemplateEditor } from "@/components/shared/PipelineRunNameTemplate/PipelineRunNameTemplateEditor";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  FLEX_NODES_ANNOTATION,
  PIPELINE_NOTES_ANNOTATION,
} from "@/utils/annotations";
import { getComponentFileFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

import PipelineIO from "../../shared/Execution/PipelineIO";
import { PipelineNotesEditor } from "./PipelineNotesEditor";
import { PipelineValidationList } from "./PipelineValidationList";
import RenamePipeline from "./RenamePipeline";

const EXCLUDED_ANNOTATIONS = [PIPELINE_NOTES_ANNOTATION, FLEX_NODES_ANNOTATION];

const PipelineDetails = () => {
  const notify = useToastNotification();
  const { componentSpec, digest, globalValidationIssues } = useComponentSpec();

  const templatizedRunNameEnabled = useFlagValue(
    "templatized-pipeline-run-name",
  );

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

  const annotations = Object.entries(componentSpec.metadata?.annotations || {})
    .filter(([key]) => !EXCLUDED_ANNOTATIONS.includes(key))
    .map(([key, value]) => ({
      label: key,
      value: String(value),
    }));

  const actions = [
    <RenamePipeline key="rename-pipeline-action" />,
    <ViewYamlButton key="view-pipeline-yaml" componentSpec={componentSpec} />,
  ];

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="pipeline-details"
    >
      <CopyText className="text-lg font-semibold">
        {componentSpec.name ?? "Unnamed Pipeline"}
      </CopyText>

      <ActionBlock actions={actions} />

      <KeyValueList title="Metadata" items={metadata} />

      <PipelineDescription componentSpec={componentSpec} />

      {templatizedRunNameEnabled && (
        <ContentBlock title="Run Name Template">
          <PipelineRunNameTemplateEditor />
        </ContentBlock>
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
        <KeyValueList title="Annotations" items={annotations} />
      )}

      <PipelineIO />

      <ContentBlock title="Validations">
        <PipelineValidationList
          groupedIssues={groupedIssues}
          globalValidationIssues={globalValidationIssues}
          onIssueSelect={handleIssueClick}
        />
      </ContentBlock>

      <ContentBlock title="Notes">
        <PipelineNotesEditor />
      </ContentBlock>
    </BlockStack>
  );
};

export default PipelineDetails;

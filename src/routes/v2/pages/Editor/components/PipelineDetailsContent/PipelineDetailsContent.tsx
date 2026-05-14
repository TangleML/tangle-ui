import { observer } from "mobx-react-lite";

import { InfoBox } from "@/components/shared/InfoBox";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { serializeComponentSpecToYaml } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { ValidationSummary } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
} from "@/utils/annotations";

import { InputsBlock } from "./components/InputsBlock";
import { MetadataBlock } from "./components/MetadataBlock";
import { OutputsBlock } from "./components/OutputsBlock";
import { PipelineDetailsCollapsibleSection } from "./components/PipelineDetailsCollapsibleSection";
import { PipelineDetailsHeader } from "./components/PipelineDetailsHeader";
import { PipelineDetailsTextField } from "./components/PipelineDetailsTextField";
import { TagsBlock } from "./components/TagsBlock";

const SYSTEM_PIPELINE_ANNOTATIONS = [
  "notes",
  PIPELINE_TAGS_ANNOTATION,
  "flex-nodes",
  "tangleml.com/editor/edge-conduits",
  "sdk",
  "editor.flow-direction",
];

export const PipelineDetailsContent = observer(
  function PipelineDetailsContent() {
    const { track } = useAnalytics();
    const { navigation } = useSharedStores();
    const pipelineSpec = useSpec();
    const { updatePipelineDescription, updatePipelineNotes } =
      usePipelineActions();

    if (!pipelineSpec) {
      return (
        <BlockStack className="h-full items-center justify-center p-4">
          <Icon name="FileQuestionMark" size="lg" className="text-gray-300" />
          <Text size="xs" tone="subdued" className="text-center mt-2">
            No pipeline loaded
          </Text>
        </BlockStack>
      );
    }

    const yamlText = serializeComponentSpecToYaml(pipelineSpec);
    const isNestedSubgraph = navigation.navigationDepth > 0;

    const handleNavigateToLevel = (index: number) => {
      navigation.navigateToLevel(index);
    };

    const handleDescriptionCommit = (value: string | undefined) => {
      if (value !== pipelineSpec.description) {
        updatePipelineDescription(pipelineSpec, value);
        track("v2.pipeline_editor.configuration_panel.description.updated");
      }
    };

    const handleNotesCommit = (value: string | undefined) => {
      const currentNotes =
        pipelineSpec.annotations.get(PIPELINE_NOTES_ANNOTATION) || undefined;
      if (value !== currentNotes) {
        updatePipelineNotes(pipelineSpec, value);
        track("v2.pipeline_editor.configuration_panel.notes.updated");
      }
    };

    return (
      <BlockStack
        className="h-full min-h-0 w-full"
        data-testid="pipeline-details-content"
      >
        <PipelineDetailsHeader
          canNavigateBack={navigation.canNavigateBack}
          navigationPath={navigation.navigationPath}
          onNavigateToLevel={handleNavigateToLevel}
          isNestedSubgraph={isNestedSubgraph}
          pipelineName={pipelineSpec.name}
          yamlText={yamlText}
        />

        <Separator />

        <BlockStack className="min-h-0 flex-1 overflow-y-auto">
          <PipelineDetailsCollapsibleSection
            title="Details"
            icon="FileText"
            openDefault
          >
            <BlockStack gap="4">
              <PipelineDetailsTextField
                title="Description"
                id="pipeline-description"
                initialValue={pipelineSpec.description ?? ""}
                onCommit={handleDescriptionCommit}
                placeholder="Add a pipeline description..."
                testId="pipeline-description-input"
              />
              <Separator />
              <PipelineDetailsTextField
                title="Notes"
                id="pipeline-notes"
                initialValue={
                  pipelineSpec.annotations.get(PIPELINE_NOTES_ANNOTATION) ?? ""
                }
                onCommit={handleNotesCommit}
                placeholder="Share context about this pipeline..."
                testId="pipeline-notes-input"
              />
              <Separator />
              <TagsBlock spec={pipelineSpec} />
            </BlockStack>
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Metadata & annotations"
            icon="Layers"
            openDefault={false}
          >
            <BlockStack gap="4">
              <MetadataBlock spec={pipelineSpec} />
              <Separator />
              <AnnotationsBlock
                annotations={pipelineSpec.annotations}
                systemAnnotationKeys={SYSTEM_PIPELINE_ANNOTATIONS}
              />
            </BlockStack>
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Inputs"
            icon="ArrowDownToLine"
            openDefault={false}
          >
            <InputsBlock spec={pipelineSpec} />
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Outputs"
            icon="ArrowUpFromLine"
            openDefault={false}
          >
            <OutputsBlock spec={pipelineSpec} />
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Validations"
            icon="BadgeCheck"
            openDefault
          >
            <BlockStack gap="2">
              {pipelineSpec.hasValidationIssues ? (
                <ValidationSummary spec={pipelineSpec} />
              ) : (
                <InfoBox
                  variant="success"
                  title="No validation issues"
                  className="text-xs"
                >
                  Pipeline is ready for submission
                </InfoBox>
              )}
            </BlockStack>
          </PipelineDetailsCollapsibleSection>
        </BlockStack>
      </BlockStack>
    );
  },
);

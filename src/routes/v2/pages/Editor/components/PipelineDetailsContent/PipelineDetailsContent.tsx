import { observer } from "mobx-react-lite";
import { type ChangeEvent, Fragment, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";
import { serializeComponentSpecToYaml } from "@/models/componentSpec";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { ValidationSummary } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  FLEX_NODES_ANNOTATION,
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
} from "@/utils/annotations";

import { InputsBlock } from "./components/InputsBlock";
import { MetadataBlock } from "./components/MetadataBlock";
import { OutputsBlock } from "./components/OutputsBlock";
import { PipelineDetailsCollapsibleSection } from "./components/PipelineDetailsCollapsibleSection";
import { PipelineDetailsTags } from "./components/PipelineDetailsTags";
import { PipelineDigestBar } from "./components/PipelineDigestBar";

const EDGE_CONDUIT_ANNOTATION = "tangleml.com/editor/edge-conduits";

const EXCLUDED_ANNOTATIONS = [
  PIPELINE_NOTES_ANNOTATION,
  PIPELINE_TAGS_ANNOTATION,
  FLEX_NODES_ANNOTATION,
  EDGE_CONDUIT_ANNOTATION,
];

export const PipelineDetailsContent = observer(
  function PipelineDetailsContent() {
    const { navigation } = useSharedStores();
    const spec = useSpec();
    const { updatePipelineDescription, updatePipelineNotes } =
      usePipelineActions();

    const [detailsOpen, setDetailsOpen] = useState(true);
    const [metadataOpen, setMetadataOpen] = useState(false);
    const [inputsOpen, setInputsOpen] = useState(false);
    const [outputsOpen, setOutputsOpen] = useState(false);
    const [validationsOpen, setValidationsOpen] = useState(true);

    const [description, setDescription] = useState(spec?.description ?? "");
    const [notes, setNotes] = useState(
      spec?.annotations.get(PIPELINE_NOTES_ANNOTATION) ?? "",
    );

    const specDescription = spec?.description ?? "";
    const specNotes = spec?.annotations.get(PIPELINE_NOTES_ANNOTATION) ?? "";

    if (
      description !== specDescription &&
      document.activeElement?.id !== "pipeline-description"
    ) {
      setDescription(specDescription);
    }

    if (
      notes !== specNotes &&
      document.activeElement?.id !== "pipeline-notes"
    ) {
      setNotes(specNotes);
    }

    if (!spec) {
      return (
        <BlockStack className="h-full items-center justify-center p-4">
          <Icon name="FileQuestionMark" size="lg" className="text-gray-300" />
          <Text size="sm" tone="subdued" className="mt-2 text-center">
            No pipeline loaded
          </Text>
        </BlockStack>
      );
    }

    const yamlText = serializeComponentSpecToYaml(spec);
    const isNestedSubgraph = navigation.navigationDepth > 0;

    const handleDescriptionInputChange = (
      event: ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setDescription(event.target.value);
    };

    const handleDescriptionBlur = () => {
      const newDescription = description || undefined;
      if (newDescription !== spec.description) {
        updatePipelineDescription(spec, newDescription);
      }
    };

    const handleNotesInputChange = (
      event: ChangeEvent<HTMLTextAreaElement>,
    ) => {
      setNotes(event.target.value);
    };

    const handleNotesBlur = () => {
      const newNotes = notes || undefined;
      const currentNotes = specNotes || undefined;
      if (newNotes !== currentNotes) {
        updatePipelineNotes(spec, newNotes);
      }
    };

    return (
      <BlockStack
        gap="0"
        className="h-full min-h-0 w-full"
        data-testid="pipeline-details-content"
      >
        <BlockStack gap="2" className="shrink-0 px-4 pb-2 pt-3">
          {navigation.canNavigateBack && (
            <InlineStack
              gap="1"
              blockAlign="center"
              wrap="wrap"
              className="min-w-0"
            >
              {navigation.navigationPath.map((entry, index) => {
                const isLast = index === navigation.navigationPath.length - 1;
                const label = index === 0 ? "Root" : entry.displayName;
                return (
                  <Fragment key={`${entry.specId}-${index}`}>
                    {index > 0 && (
                      <Icon
                        name="ChevronRight"
                        size="xs"
                        className="shrink-0 text-muted-foreground"
                      />
                    )}
                    {!isLast && (
                      <Button
                        type="button"
                        variant="link"
                        size="inline-xs"
                        className="h-auto min-w-0 shrink truncate px-0 py-0"
                        onClick={() => navigation.navigateToLevel(index)}
                      >
                        {label}
                      </Button>
                    )}
                  </Fragment>
                );
              })}
            </InlineStack>
          )}
          <InlineStack
            gap="2"
            blockAlign="center"
            wrap="nowrap"
            className="min-w-0 w-full"
          >
            {isNestedSubgraph && (
              <Icon name="Workflow" size="sm" className="shrink-0" />
            )}
            <Text size="md" weight="semibold" className="wrap-anywhere min-w-0">
              {spec.name}
            </Text>
          </InlineStack>

          <PipelineDigestBar yamlText={yamlText} pipelineName={spec.name} />
        </BlockStack>

        <Separator />

        <BlockStack gap="0" className="min-h-0 flex-1 overflow-y-auto">
          <PipelineDetailsCollapsibleSection
            title="Details"
            icon="FileText"
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          >
            <BlockStack gap="4">
              <BlockStack gap="2">
                <Heading level={3}>Description</Heading>
                <Textarea
                  id="pipeline-description"
                  value={description}
                  onChange={handleDescriptionInputChange}
                  onBlur={handleDescriptionBlur}
                  placeholder="Add a pipeline description..."
                  className="min-h-16 resize-y text-xs!"
                  data-testid="pipeline-description-input"
                />
              </BlockStack>
              <BlockStack gap="2">
                <Heading level={3}>Notes</Heading>
                <Textarea
                  id="pipeline-notes"
                  value={notes}
                  onChange={handleNotesInputChange}
                  onBlur={handleNotesBlur}
                  placeholder="Share context about this pipeline..."
                  className="min-h-16 resize-y text-xs!"
                  data-testid="pipeline-notes-input"
                />
              </BlockStack>
              <BlockStack gap="2">
                <Heading level={3}>Tags</Heading>
                <PipelineDetailsTags spec={spec} />
              </BlockStack>
            </BlockStack>
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Metadata & annotations"
            icon="Info"
            open={metadataOpen}
            onOpenChange={setMetadataOpen}
          >
            <BlockStack gap="4">
              <MetadataBlock spec={spec} />
              <Separator />
              <BlockStack gap="2">
                <Heading level={3}>Annotations</Heading>
                <AnnotationsBlock
                  annotations={spec.annotations}
                  ignoreAnnotationKeys={EXCLUDED_ANNOTATIONS}
                  listTitle={null}
                />
              </BlockStack>
            </BlockStack>
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Inputs"
            icon="ArrowDownFromLine"
            open={inputsOpen}
            onOpenChange={setInputsOpen}
          >
            <InputsBlock spec={spec} embedded />
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Outputs"
            icon="ArrowUpFromLine"
            open={outputsOpen}
            onOpenChange={setOutputsOpen}
          >
            <OutputsBlock spec={spec} embedded />
          </PipelineDetailsCollapsibleSection>

          <PipelineDetailsCollapsibleSection
            title="Validations"
            icon="ShieldAlert"
            open={validationsOpen}
            onOpenChange={setValidationsOpen}
          >
            {spec.hasValidationIssues ? (
              <ValidationSummary spec={spec} />
            ) : (
              <InfoBox variant="success" title="No validation issues">
                Pipeline is ready for submission
              </InfoBox>
            )}
          </PipelineDetailsCollapsibleSection>
        </BlockStack>
      </BlockStack>
    );
  },
);

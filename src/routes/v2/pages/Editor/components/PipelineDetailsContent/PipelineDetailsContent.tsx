import { observer } from "mobx-react-lite";
import { type ChangeEvent, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { InfoBox } from "@/components/shared/InfoBox";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { serializeComponentSpecToYaml } from "@/models/componentSpec";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { ValidationSummary } from "@/routes/v2/pages/Editor/components/ValidationSummary";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { PIPELINE_NOTES_ANNOTATION } from "@/utils/annotations";
import { PIPELINE_TAGS_ANNOTATION } from "@/utils/annotations";

import { DigestBlock } from "./components/DigestBlock";
import { InputsBlock } from "./components/InputsBlock";
import { MetadataBlock } from "./components/MetadataBlock";
import { OutputsBlock } from "./components/OutputsBlock";
import { TagsBlock } from "./components/TagsBlock";

const EXCLUDED_ANNOTATIONS = [
  "notes",
  PIPELINE_TAGS_ANNOTATION,
  "flex-nodes",
  "tangleml.com/editor/edge-conduits",
];

export const PipelineDetailsContent = observer(
  function PipelineDetailsContent() {
    const spec = useSpec();
    const { updatePipelineDescription, updatePipelineNotes } =
      usePipelineActions();

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
          <Text size="sm" tone="subdued" className="text-center mt-2">
            No pipeline loaded
          </Text>
        </BlockStack>
      );
    }

    const yamlText = serializeComponentSpecToYaml(spec);

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
        gap="4"
        className="h-full overflow-y-auto px-2 py-3"
        data-testid="pipeline-details-content"
      >
        <DigestBlock yamlText={yamlText} />

        <MetadataBlock spec={spec} />

        <ContentBlock title="Description">
          <Textarea
            id="pipeline-description"
            value={description}
            onChange={handleDescriptionInputChange}
            onBlur={handleDescriptionBlur}
            placeholder="Add a pipeline description..."
            className="min-h-16 resize-y text-xs!"
            data-testid="pipeline-description-input"
          />
        </ContentBlock>

        <InputsBlock spec={spec} />

        <OutputsBlock spec={spec} />

        <AnnotationsBlock
          annotations={spec.annotations}
          ignoreAnnotationKeys={EXCLUDED_ANNOTATIONS}
        />

        <ContentBlock title="Validations">
          {spec.hasValidationIssues ? (
            <ValidationSummary spec={spec} />
          ) : (
            <InfoBox variant="success" title="No validation issues">
              Pipeline is ready for submission
            </InfoBox>
          )}
        </ContentBlock>

        <ContentBlock title="Notes">
          <Textarea
            id="pipeline-notes"
            value={notes}
            onChange={handleNotesInputChange}
            onBlur={handleNotesBlur}
            placeholder="Share context about this pipeline..."
            className="min-h-16 resize-y text-xs!"
            data-testid="pipeline-notes-input"
          />
        </ContentBlock>

        <TagsBlock spec={spec} />
      </BlockStack>
    );
  },
);

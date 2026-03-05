import { observer } from "mobx-react-lite";
import { type ChangeEvent, useState } from "react";

import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { InfoBox } from "@/components/shared/InfoBox";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import type { TypeSpecType } from "@/models/componentSpec/entities/types";

import { useSpec } from "../providers/SpecContext";
import { updatePipelineDescription } from "../store/actions";
import { RenamePipelineButton } from "./RenamePipelineButton";
import { ValidationSummary } from "./ValidationSummary";
import { ViewYamlButton } from "./ViewYamlButton";

const EXCLUDED_ANNOTATIONS = ["notes", "flex-nodes"];

function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "Any";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}

export const PipelineDetailsContent = observer(
  function PipelineDetailsContent() {
    const spec = useSpec();

    const [description, setDescription] = useState(spec?.description ?? "");

    // Sync local state when spec description changes externally (e.g., undo/redo).
    const specDescription = spec?.description ?? "";
    if (
      description !== specDescription &&
      document.activeElement?.id !== "pipeline-description"
    ) {
      setDescription(specDescription);
    }

    if (!spec) {
      return <EmptyState />;
    }

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

    const annotations = spec.annotations
      .filter((a) => !EXCLUDED_ANNOTATIONS.includes(a.key))
      .map((a) => ({
        label: a.key,
        value: String(a.value),
      }));

    return (
      <BlockStack
        gap="4"
        className="h-full overflow-y-auto px-2 py-3"
        data-testid="pipeline-details-content"
      >
        <CopyText className="text-sm font-semibold">
          {spec.name ?? "Unnamed Pipeline"}
        </CopyText>

        <ActionBlock
          actions={[
            <RenamePipelineButton key="rename-pipeline" spec={spec} />,
            <ViewYamlButton key="view-yaml" spec={spec} />,
          ]}
        />

        <ContentBlock title="Description">
          <Textarea
            id="pipeline-description"
            value={description}
            onChange={handleDescriptionInputChange}
            onBlur={handleDescriptionBlur}
            placeholder="Add a pipeline description..."
            className="min-h-16 resize-y text-sm"
            data-testid="pipeline-description-input"
          />
        </ContentBlock>

        <ContentBlock title="Inputs">
          {spec.inputs.length > 0 ? (
            <BlockStack>
              {spec.inputs.map((input) => (
                <InlineStack
                  key={input.$id}
                  gap="1"
                  align="space-between"
                  blockAlign="center"
                  className="even:bg-white odd:bg-secondary px-2 py-0.5 rounded-xs w-full"
                  wrap="nowrap"
                >
                  <Text size="xs" weight="semibold" className="truncate">
                    {input.name}
                  </Text>
                  <InlineStack gap="1" className="shrink-0" blockAlign="center">
                    <Text size="xs" tone="subdued">
                      ({typeSpecToString(input.type)})
                    </Text>
                    {input.optional && (
                      <Badge size="sm" variant="outline">
                        optional
                      </Badge>
                    )}
                  </InlineStack>
                </InlineStack>
              ))}
            </BlockStack>
          ) : (
            <Text size="xs" tone="subdued">
              No inputs
            </Text>
          )}
        </ContentBlock>

        <ContentBlock title="Outputs">
          {spec.outputs.length > 0 ? (
            <BlockStack>
              {spec.outputs.map((output) => (
                <InlineStack
                  key={output.$id}
                  gap="1"
                  align="space-between"
                  blockAlign="center"
                  className="even:bg-white odd:bg-secondary px-2 py-0.5 rounded-xs w-full"
                  wrap="nowrap"
                >
                  <Text size="xs" weight="semibold" className="truncate">
                    {output.name}
                  </Text>
                  <Text size="xs" tone="subdued" className="shrink-0">
                    ({typeSpecToString(output.type)})
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          ) : (
            <Text size="xs" tone="subdued">
              No outputs
            </Text>
          )}
        </ContentBlock>

        {annotations.length > 0 && (
          <KeyValueList title="Annotations" items={annotations} />
        )}

        <ContentBlock title="Validations">
          {spec.validationIssues.length === 0 ? (
            <InfoBox variant="success" title="No validation issues">
              Pipeline is ready for submission
            </InfoBox>
          ) : (
            <ValidationSummary spec={spec} />
          )}
        </ContentBlock>
      </BlockStack>
    );
  },
);

function EmptyState() {
  return (
    <BlockStack className="h-full items-center justify-center p-4">
      <Icon name="FileQuestionMark" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        No pipeline loaded
      </Text>
    </BlockStack>
  );
}

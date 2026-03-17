import { useSuspenseQuery } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import { type ChangeEvent, useState } from "react";

import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { InfoBox } from "@/components/shared/InfoBox";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import {
  type ComponentSpec,
  type Input,
  JsonSerializer,
  type Output,
} from "@/models/componentSpec";
import type { TypeSpecType } from "@/models/componentSpec/entities/types";
import { type ComponentSpec as WiredComponentSpec } from "@/utils/componentSpec";
import {
  generateDigest,
  getComponentFileFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";

import { useSpec } from "../../providers/SpecContext";
import { updatePipelineDescription } from "../../store/actions";
import { selectNode, setPendingFocusNode } from "../../store/editorStore";
import { navigateToPath } from "../../store/navigationStore";
import { AnnotationsBlock } from "../AnnotationsBlock/AnnotationsBlock";
import { ValidationSummary } from "../ValidationSummary";
import { RenamePipelineButton } from "./components/RenamePipelineButton";
import { ViewYamlButton } from "./components/ViewYamlButton";

const EXCLUDED_ANNOTATIONS = [
  "notes",
  "flex-nodes",
  "tangleml.com/editor/edge-conduits",
];

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

        <DigestBlock spec={spec} />

        <MetadataBlock spec={spec} />

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

        <InputsBlock spec={spec} />

        <OutputsBlock spec={spec} />

        <AnnotationsBlock
          annotations={spec.annotations}
          ignoreAnnotationKeys={EXCLUDED_ANNOTATIONS}
        />

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

const serializer = new JsonSerializer();

const DigestBlock = withSuspenseWrapper(function DigestBlock({
  spec,
}: {
  spec: ComponentSpec;
}) {
  const { data: digest } = useSuspenseQuery({
    queryKey: ["pipeline-digest", spec.name],
    staleTime: 0,
    queryFn: () =>
      generateDigest(
        componentSpecToYaml(serializer.serialize(spec) as WiredComponentSpec),
      ),
  });

  return (
    <ContentBlock title="Digest">
      <BlockStack className="bg-secondary p-2 rounded-md border truncate text-sm">
        <CopyText className="font-mono truncate">{digest}</CopyText>
      </BlockStack>
    </ContentBlock>
  );
});

function InputsBlock({ spec }: { spec: ComponentSpec }) {
  const handleClick = (input: Input) => {
    navigateToPath([spec.name]);
    setPendingFocusNode(input.$id);
    selectNode(input.$id, "input");
  };

  return (
    <ContentBlock title="Inputs">
      {spec.inputs.length > 0 ? (
        <BlockStack data-testid="pipeline-inputs">
          {spec.inputs.map((input) => (
            <InlineStack
              key={input.$id}
              gap="1"
              align="space-between"
              blockAlign="center"
              className="even:bg-white odd:bg-secondary px-2 py-0.5 rounded-xs w-full"
              wrap="nowrap"
            >
              <Button
                variant="ghost"
                size="xs"
                className="truncate"
                onClick={() => handleClick(input)}
              >
                {input.name}
              </Button>
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
  );
}

const MetadataBlock = withSuspenseWrapper(function MetadataBlock({
  spec,
}: {
  spec: ComponentSpec;
}) {
  const { data: fileMeta } = useSuspenseQuery({
    queryKey: ["file-meta", spec.name],
    queryFn: () =>
      getComponentFileFromList(USER_PIPELINES_LIST_NAME, spec.name),
  });

  const metadata = fileMeta
    ? [
        {
          label: "Created by",
          value: fileMeta.componentRef.spec.metadata?.annotations?.author,
        },
        {
          label: "Created at",
          value: fileMeta.creationTime?.toLocaleString(),
        },
        {
          label: "Last updated",
          value: fileMeta.modificationTime?.toLocaleString(),
        },
      ]
    : [];

  return <KeyValueList title="Metadata" items={metadata} />;
});

function OutputsBlock({ spec }: { spec: ComponentSpec }) {
  const handleClick = (output: Output) => {
    navigateToPath([spec.name]);
    setPendingFocusNode(output.$id);
    selectNode(output.$id, "output");
  };

  return (
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
              <Button
                variant="ghost"
                size="xs"
                className="truncate"
                onClick={() => handleClick(output)}
              >
                {output.name}
              </Button>
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
  );
}

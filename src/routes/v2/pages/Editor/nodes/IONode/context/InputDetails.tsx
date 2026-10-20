import { observer } from "mobx-react-lite";
import { type ChangeEvent, type FocusEvent } from "react";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { InputLabel } from "@/routes/v2/pages/Editor/components/InputLabel/InputLabel";
import { EditorNodeLinkButton } from "@/routes/v2/pages/Editor/components/RemotePipelineNodeLinkButton";
import { useIOActions } from "@/routes/v2/pages/Editor/store/actions/useIOActions";
import { AutoGrowTextarea } from "@/routes/v2/shared/components/AutoGrowTextArea";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

interface InputDetailsProps {
  entityId: string;
}

export const InputDetails = observer(function InputDetails({
  entityId,
}: InputDetailsProps) {
  const { track } = useAnalytics();
  const ioActions = useIOActions();
  const spec = useSpec();
  const input = spec?.inputs.find((i) => i.$id === entityId);

  if (!spec || !input) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== input.name) {
      ioActions.renameInput(spec, entityId, newName);
      track("v2.pipeline_editor.input_details.name.updated");
    }
  };

  const handleDescriptionChange = (event: FocusEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const newDescription = value || undefined;
    if (newDescription !== input.description) {
      ioActions.setInputDescription(spec, entityId, newDescription);
      track("v2.pipeline_editor.input_details.description.updated");
    }
  };

  const handleTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const newType = value || undefined;
    if (newType !== input.type) {
      ioActions.setInputType(spec, entityId, newType);
      track("v2.pipeline_editor.input_details.type.updated");
    }
  };

  const effectiveValue = input.value ?? input.defaultValue;

  const handleValueChange = (value: string) => {
    const newValue = value || undefined;
    if (newValue !== effectiveValue) {
      ioActions.setInputValue(spec, entityId, newValue);
      track("v2.pipeline_editor.input_details.default_value.updated");
    }
  };

  return (
    <BlockStack>
      <BlockStack gap="4" className="p-3">
        <EditorNodeLinkButton entityId={entityId} nodeType="input" />
        <BlockStack gap="2">
          <InputLabel htmlFor="input-name" onCopy={() => input.name}>
            Name
          </InputLabel>
          <Input
            key={`${entityId}-name`}
            id="input-name"
            defaultValue={input.name}
            onBlur={handleNameChange}
            className="font-mono text-xs!"
          />
        </BlockStack>

        <BlockStack gap="2">
          <InputLabel
            htmlFor="input-type"
            onCopy={() => (input.type ? String(input.type) : "")}
          >
            Type
          </InputLabel>
          <Input
            key={`${entityId}-type`}
            id="input-type"
            defaultValue={input.type ? String(input.type) : ""}
            placeholder="e.g. String, Integer, Float"
            onBlur={handleTypeChange}
            className="font-mono text-xs!"
          />
        </BlockStack>

        <BlockStack gap="2">
          <InputLabel
            htmlFor="input-description"
            onCopy={() => input.description}
          >
            Description
          </InputLabel>
          <Textarea
            key={`${entityId}-desc`}
            id="input-description"
            defaultValue={input.description ?? ""}
            placeholder="Describe this input..."
            onBlur={handleDescriptionChange}
            className="text-xs!"
            rows={2}
          />
        </BlockStack>

        <BlockStack gap="2">
          <InlineStack
            gap="2"
            blockAlign="center"
            align="space-between"
            className="w-full"
          >
            <InputLabel htmlFor="input-value" onCopy={() => effectiveValue}>
              Value
            </InputLabel>
            <InlineStack gap="1" blockAlign="center">
              <Icon
                name="SquareCheckBig"
                size="sm"
                className="text-muted-foreground"
              />
              <Text size="xs" tone="subdued">
                Use as default
              </Text>
            </InlineStack>
          </InlineStack>

          <AutoGrowTextarea
            id="input-value"
            key={`${entityId}-value`}
            expandDialogTitle="Value"
            highlightSyntax={true}
            defaultValue={effectiveValue}
            onChangeComplete={handleValueChange}
            placeholder="Value"
            className="h-4 min-h-4 text-xs font-mono"
            data-testid="input-value"
          />
        </BlockStack>

        <InlineStack gap="2">
          <Text size="xs" tone="subdued">
            Optional:
          </Text>
          <Text size="xs" weight="semibold" tone="subdued">
            {input.optional ? "Yes" : "No"}
          </Text>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
});

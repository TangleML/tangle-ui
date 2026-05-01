import { observer } from "mobx-react-lite";
import { type ChangeEvent, type FocusEvent } from "react";

import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { AutoGrowTextarea } from "@/routes/v2/pages/Editor/components/AutoGrowTextArea";
import { InputLabel } from "@/routes/v2/pages/Editor/components/InputLabel/InputLabel";
import { useIOActions } from "@/routes/v2/pages/Editor/store/actions/useIOActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

interface InputDetailsProps {
  entityId: string;
}

export const InputDetails = observer(function InputDetails({
  entityId,
}: InputDetailsProps) {
  const ioActions = useIOActions();
  const spec = useSpec();
  const input = spec?.inputs.find((i) => i.$id === entityId);

  if (!spec || !input) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== input.name) {
      ioActions.renameInput(spec, entityId, newName);
    }
  };

  const handleDescriptionChange = (event: FocusEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const newDescription = value || undefined;
    if (newDescription !== input.description) {
      ioActions.setInputDescription(spec, entityId, newDescription);
    }
  };

  const handleTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const newType = value || undefined;
    if (newType !== input.type) {
      ioActions.setInputType(spec, entityId, newType);
    }
  };

  const handleDefaultValueChange = (value: string) => {
    const newDefault = value || undefined;
    if (newDefault !== input.defaultValue) {
      ioActions.setInputDefaultValue(spec, entityId, newDefault);
    }
  };

  return (
    <BlockStack>
      <BlockStack gap="4" className="p-3">
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
          <InputLabel
            htmlFor="input-default-value"
            onCopy={() => input.defaultValue}
          >
            Default Value
          </InputLabel>

          <AutoGrowTextarea
            id="input-default-value"
            key={`${entityId}-default-value`}
            expandDialogTitle="Default Value"
            highlightSyntax={true}
            defaultValue={input.defaultValue}
            onChangeComplete={handleDefaultValueChange}
            placeholder="Default value"
            className="h-4 min-h-4 text-xs font-mono"
            data-testid="input-default-value"
          />
        </BlockStack>

        <InlineStack gap="2">
          <Text size="xs" className="text-gray-400">
            Optional:
          </Text>
          <Text size="xs" weight="semibold" className="text-muted-foreground">
            {input.optional ? "Yes" : "No"}
          </Text>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
});

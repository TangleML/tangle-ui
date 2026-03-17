import { observer } from "mobx-react-lite";
import { type ChangeEvent, type FocusEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../../../providers/SpecContext";
import {
  renameInput,
  setInputDefaultValue,
  setInputDescription,
  setInputType,
} from "../../../store/actions";

interface InputDetailsProps {
  entityId: string;
}

export const InputDetails = observer(function InputDetails({
  entityId,
}: InputDetailsProps) {
  const spec = useSpec();
  const input = spec?.inputs.find((i) => i.$id === entityId);

  if (!spec || !input) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== input.name) {
      renameInput(spec, entityId, newName);
    }
  };

  const handleDescriptionChange = (event: FocusEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const newDescription = value || undefined;
    if (newDescription !== input.description) {
      setInputDescription(spec, entityId, newDescription);
    }
  };

  const handleTypeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const newType = value || undefined;
    if (newType !== input.type) {
      setInputType(spec, entityId, newType);
    }
  };

  const handleDefaultValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const newDefault = value || undefined;
    if (newDefault !== input.defaultValue) {
      setInputDefaultValue(spec, entityId, newDefault);
    }
  };

  return (
    <BlockStack>
      <BlockStack gap="4" className="p-3">
        <BlockStack gap="2">
          <Label htmlFor="input-name" className="text-gray-600">
            Name
          </Label>
          <Input
            key={`${entityId}-${input.name}`}
            id="input-name"
            defaultValue={input.name}
            onBlur={handleNameChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        <BlockStack gap="2">
          <Label htmlFor="input-type" className="text-gray-600">
            Type
          </Label>
          <Input
            key={`${entityId}-type-${String(input.type ?? "")}`}
            id="input-type"
            defaultValue={input.type ? String(input.type) : ""}
            placeholder="e.g. String, Integer, Float"
            onBlur={handleTypeChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        <BlockStack gap="2">
          <Label htmlFor="input-description" className="text-gray-600">
            Description
          </Label>
          <Textarea
            key={`${entityId}-desc-${input.description ?? ""}`}
            id="input-description"
            defaultValue={input.description ?? ""}
            placeholder="Describe this input..."
            onBlur={handleDescriptionChange}
            className="text-sm"
            rows={2}
          />
        </BlockStack>

        <BlockStack gap="2">
          <Label htmlFor="input-default-value" className="text-gray-600">
            Default Value
          </Label>
          <Input
            key={`${entityId}-default-${input.defaultValue ?? ""}`}
            id="input-default-value"
            defaultValue={input.defaultValue ?? ""}
            placeholder="Default value"
            onBlur={handleDefaultValueChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        <InlineStack gap="2">
          <Text size="xs" className="text-gray-400">
            Optional:
          </Text>
          <Text size="xs" weight="semibold" className="text-gray-600">
            {input.optional ? "Yes" : "No"}
          </Text>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
});

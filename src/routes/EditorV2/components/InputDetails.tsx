import { observer } from "mobx-react-lite";
import { type ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../providers/SpecContext";
import { renameInput } from "../store/actions";

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

        {input.type && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Type</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {String(input.type)}
            </Text>
          </BlockStack>
        )}

        {input.description && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Description</Label>
            <Text size="sm" className="text-gray-500">
              {input.description}
            </Text>
          </BlockStack>
        )}

        {input.defaultValue !== undefined && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Default Value</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {input.defaultValue}
            </Text>
          </BlockStack>
        )}

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

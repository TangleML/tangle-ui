import { observer } from "mobx-react-lite";
import { type ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../providers/SpecContext";
import { renameOutput } from "../store/actions";

interface OutputDetailsProps {
  entityId: string;
}

export const OutputDetails = observer(function OutputDetails({
  entityId,
}: OutputDetailsProps) {
  const spec = useSpec();
  const output = spec?.outputs.find((o) => o.$id === entityId);

  if (!spec || !output) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== output.name) {
      renameOutput(spec, entityId, newName);
    }
  };

  return (
    <BlockStack>
      <BlockStack gap="4" className="p-3">
        <BlockStack gap="2">
          <Label htmlFor="output-name" className="text-gray-600">
            Name
          </Label>
          <Input
            key={`${entityId}-${output.name}`}
            id="output-name"
            defaultValue={output.name}
            onBlur={handleNameChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        {output.type && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Type</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {String(output.type)}
            </Text>
          </BlockStack>
        )}

        {output.description && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Description</Label>
            <Text size="sm" className="text-gray-500">
              {output.description}
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
});

import { observer } from "mobx-react-lite";
import { type ChangeEvent, type FocusEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../../../providers/SpecContext";
import { renameOutput, setOutputDescription } from "../../../store/actions";

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

  const handleDescriptionChange = (event: FocusEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const newDescription = value || undefined;
    if (newDescription !== output.description) {
      setOutputDescription(spec, entityId, newDescription);
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

        <BlockStack gap="2">
          <Label htmlFor="output-description" className="text-gray-600">
            Description
          </Label>
          <Textarea
            key={`${entityId}-desc-${output.description ?? ""}`}
            id="output-description"
            defaultValue={output.description ?? ""}
            placeholder="Describe this output..."
            onBlur={handleDescriptionChange}
            className="text-sm"
            rows={2}
          />
        </BlockStack>
      </BlockStack>
    </BlockStack>
  );
});

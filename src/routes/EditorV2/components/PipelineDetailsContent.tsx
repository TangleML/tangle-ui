import { observer } from "mobx-react-lite";
import { type ChangeEvent, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";

import { useSpec } from "../providers/SpecContext";
import { renamePipeline, updatePipelineDescription } from "../store/actions";

/**
 * Content for the Pipeline Details window.
 * Displays information about the pipeline itself (name, description, inputs/outputs).
 * Used within the Windows system.
 */
export const PipelineDetailsContent = observer(
  function PipelineDetailsContent() {
    const spec = useSpec();

    const [description, setDescription] = useState(spec?.description ?? "");

    // Sync local state when spec description changes externally (e.g., undo/redo).
    // MobX observer handles re-renders; we just need to keep local state in sync.
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

    const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
      const newName = event.target.value;
      if (newName && newName !== spec.name) {
        renamePipeline(spec, newName);
      }
    };

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

    const inputs = spec.inputs;
    const outputs = spec.outputs;
    const annotations = spec.annotations
      .filter((a) => a.key.startsWith("metadata."))
      .map(
        (a) => [a.key.slice("metadata.".length), a.value] as [string, unknown],
      );

    return (
      <BlockStack className="h-full bg-white overflow-y-auto">
        <BlockStack gap="4" className="p-3">
          {/* Name */}
          <BlockStack gap="2">
            <Label htmlFor="pipeline-name" className="text-gray-600">
              Name
            </Label>
            <Input
              id="pipeline-name"
              defaultValue={spec.name}
              onBlur={handleNameChange}
              className="font-mono text-sm"
              data-testid="pipeline-name-input"
            />
          </BlockStack>

          {/* Description */}
          <BlockStack gap="2">
            <Label htmlFor="pipeline-description" className="text-gray-600">
              Description
            </Label>
            <Textarea
              id="pipeline-description"
              value={description}
              onChange={handleDescriptionInputChange}
              onBlur={handleDescriptionBlur}
              placeholder="Add a pipeline description..."
              className="min-h-16 resize-y text-sm"
              data-testid="pipeline-description-input"
            />
          </BlockStack>

          <Separator />

          {/* Inputs */}
          {inputs.length > 0 && (
            <BlockStack gap="2">
              <InlineStack gap="2" blockAlign="center">
                <Icon name="Download" size="sm" className="text-blue-500" />
                <Label className="text-gray-600">Inputs</Label>
              </InlineStack>
              <BlockStack gap="1">
                {inputs.map((input) => (
                  <InlineStack
                    key={input.$id}
                    gap="2"
                    className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                  >
                    <Text size="xs" weight="semibold" className="text-gray-700">
                      {input.name}
                    </Text>
                    {input.type && (
                      <Text size="xs" className="text-gray-500">
                        : {String(input.type)}
                      </Text>
                    )}
                    {input.optional && (
                      <Text size="xs" className="text-gray-400 italic">
                        (optional)
                      </Text>
                    )}
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          )}

          {/* Outputs */}
          {outputs.length > 0 && (
            <BlockStack gap="2">
              <InlineStack gap="2" blockAlign="center">
                <Icon name="Upload" size="sm" className="text-green-500" />
                <Label className="text-gray-600">Outputs</Label>
              </InlineStack>
              <BlockStack gap="1">
                {outputs.map((output) => (
                  <InlineStack
                    key={output.$id}
                    gap="2"
                    className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                  >
                    <Text size="xs" weight="semibold" className="text-gray-700">
                      {output.name}
                    </Text>
                    {output.type && (
                      <Text size="xs" className="text-gray-500">
                        : {String(output.type)}
                      </Text>
                    )}
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          )}

          {/* Annotations */}
          {annotations.length > 0 && (
            <>
              <Separator />
              <BlockStack gap="2">
                <Label className="text-gray-600">Annotations</Label>
                <BlockStack gap="1">
                  {annotations.map(([key, value]) => (
                    <BlockStack
                      key={key}
                      gap="1"
                      className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                    >
                      <Text
                        size="xs"
                        weight="semibold"
                        className="text-gray-600"
                      >
                        {key}
                      </Text>
                      <Text size="xs" className="text-gray-500 break-all">
                        {String(value)}
                      </Text>
                    </BlockStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </>
          )}
        </BlockStack>
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

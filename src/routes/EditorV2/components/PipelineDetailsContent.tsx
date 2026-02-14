import type { ChangeEvent } from "react";
import { useSnapshot } from "valtio";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";

import { renamePipeline, updatePipelineDescription } from "../store/actions";
import { editorStore } from "../store/editorStore";

/**
 * Content for the Pipeline Details window.
 * Displays information about the pipeline itself (name, description, inputs/outputs).
 * Used within the Windows system.
 */
export function PipelineDetailsContent() {
  const snapshot = useSnapshot(editorStore);
  const { spec } = snapshot;

  if (!spec) {
    return <EmptyState />;
  }

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== spec.name) {
      renamePipeline(newName);
    }
  };

  const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = event.target.value;
    updatePipelineDescription(newDescription || undefined);
  };

  const inputs = Object.values(spec.inputs.entities);
  const outputs = Object.values(spec.outputs.entities);
  const annotations = spec.metadata?.annotations
    ? Object.entries(spec.metadata.annotations)
    : [];

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
            defaultValue={spec.description ?? ""}
            onBlur={handleDescriptionChange}
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
                    gap="0.5"
                    className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                  >
                    <Text size="xs" weight="semibold" className="text-gray-600">
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
}

function EmptyState() {
  return (
    <BlockStack className="h-full items-center justify-center p-4">
      <Icon name="FileQuestion" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        No pipeline loaded
      </Text>
    </BlockStack>
  );
}

interface PanelHeaderProps {
  icon: string;
  iconClassName?: string;
  title: string;
}

function PanelHeader({ icon, iconClassName, title }: PanelHeaderProps) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className="p-3 border-b border-gray-200 bg-gray-50"
    >
      <Icon
        name={icon as Parameters<typeof Icon>[0]["name"]}
        size="sm"
        className={iconClassName}
      />
      <Text size="sm" weight="semibold" className="text-gray-700">
        {title}
      </Text>
    </InlineStack>
  );
}

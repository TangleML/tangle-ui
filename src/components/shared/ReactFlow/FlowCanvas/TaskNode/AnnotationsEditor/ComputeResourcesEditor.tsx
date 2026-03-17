import { useCallback } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import { getAnnotationValue } from "@/utils/annotations";

import { AnnotationsInput } from "./AnnotationsInput";
import { DescriptionWithLinks } from "./DescriptionWithLinks";

interface ComputeResourcesEditorProps {
  annotations: Annotations;
  resources: AnnotationConfig[];
  cloudProviderConfig: AnnotationConfig | null;
  onSave: (key: string, value: string) => void;
}

export const ComputeResourcesEditor = ({
  annotations,
  resources,
  cloudProviderConfig,
  onSave,
}: ComputeResourcesEditorProps) => {
  return (
    <BlockStack gap="2">
      <Heading level={1}>Compute Resources</Heading>

      <BlockStack gap="4">
        {cloudProviderConfig && (
          <ComputeResourceField
            key={cloudProviderConfig.annotation}
            resource={cloudProviderConfig}
            annotations={annotations}
            onSave={onSave}
          />
        )}

        {resources.map((resource) => (
          <ComputeResourceField
            key={resource.annotation}
            resource={resource}
            annotations={annotations}
            onSave={onSave}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
};

interface ComputeResourceFieldProps {
  resource: AnnotationConfig;
  annotations: Annotations;
  onSave: (key: string, value: string) => void;
}

const ComputeResourceField = ({
  resource,
  annotations,
  onSave,
}: ComputeResourceFieldProps) => {
  const handleValueBlur = useCallback(
    (value: string) => {
      const formattedValue = resource.append
        ? `${value}${resource.append}`
        : value;
      onSave(resource.annotation, formattedValue);
    },
    [resource, onSave],
  );

  const rawValue = getAnnotationValue(annotations, resource.annotation, "");
  const value =
    resource.append && rawValue
      ? rawValue.replace(new RegExp(`${resource.append}$`), "")
      : rawValue;

  const label = resource.label + (resource.unit ? ` (${resource.unit})` : "");

  return (
    <BlockStack key={resource.annotation}>
      <InlineStack gap="1" align="center">
        <Paragraph size="xs" tone="subdued">
          {label}
        </Paragraph>
        {resource.required && (
          <Paragraph size="xs" tone="critical">
            *
          </Paragraph>
        )}
        {resource.description && (
          <Popover>
            <PopoverTrigger asChild>
              <TooltipButton
                tooltip="Description"
                variant="ghost"
                size="min"
                className="[&_svg]:size-3 text-muted-foreground hover:text-foreground"
              >
                <Icon name="Info" />
              </TooltipButton>
            </PopoverTrigger>
            <PopoverContent>
              <Paragraph size="xs" tone="subdued" className="italic">
                <DescriptionWithLinks text={resource.description} />
              </Paragraph>
            </PopoverContent>
          </Popover>
        )}
      </InlineStack>

      <AnnotationsInput
        value={value}
        config={resource}
        onBlur={handleValueBlur}
        annotations={annotations}
        className="mr-8"
      />
    </BlockStack>
  );
};

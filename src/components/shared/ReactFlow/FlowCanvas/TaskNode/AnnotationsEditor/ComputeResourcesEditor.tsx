import { useCallback } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { AnnotationConfig, Annotations } from "@/types/annotations";

import { AnnotationsInput } from "./AnnotationsInput";

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

  const value =
    resource.append && annotations[resource.annotation]
      ? annotations[resource.annotation].replace(
          new RegExp(`${resource.append}$`),
          "",
        )
      : annotations[resource.annotation];

  const label = resource.label + (resource.unit ? ` (${resource.unit})` : "");

  return (
    <BlockStack key={resource.annotation}>
      <Paragraph size="xs" tone="subdued">
        {label}
      </Paragraph>

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

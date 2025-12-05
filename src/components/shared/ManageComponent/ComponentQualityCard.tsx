import { type PropsWithChildren } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import type { HydratedComponentReference } from "@/utils/componentSpec";

const ComponentSpecCheckStatement = ({
  isValid,
  validLabel,
  invalidLabel,
  children,
}: PropsWithChildren<{
  isValid: boolean;
  validLabel: string;
  invalidLabel: string;
}>) => {
  return (
    <InlineStack gap="2" align="start">
      {isValid ? (
        <Icon name="Check" className="text-green-500" />
      ) : (
        <Icon name="OctagonAlert" className="text-yellow-500" />
      )}
      <Text as="span" size="sm">
        {isValid ? validLabel : invalidLabel}
      </Text>
      {children}
    </InlineStack>
  );
};

export const ComponentQualityCard = ({
  component,
}: {
  component: HydratedComponentReference;
}) => {
  const {
    hasName,
    hasDescription,
    inputsValid,
    outputsValid,
    invalidInputs,
    invalidOutputs,
  } = checkComponentQuality(component);

  return (
    <BlockStack gap="2">
      <Heading level={2}>ComponentSpec quality check</Heading>
      <Text as="p" size="xs" tone="subdued">
        Although following the ComponentSpec quality standard is not strictly
        required for publishing, we strongly encourage you to adhere to it.
        High-quality specifications help ensure your component is
        well-documented, maintainable, and easily reusable by others in your
        workspace. Meeting these standards improves discoverability and
        collaboration across teams.
      </Text>
      <BlockStack gap="1" className="border-l pl-2">
        <ComponentSpecCheckStatement
          isValid={hasName}
          validLabel="Component has a name"
          invalidLabel="Component is missing a name"
        />

        <ComponentSpecCheckStatement
          isValid={hasDescription}
          validLabel="Component has a description"
          invalidLabel="Component is missing a description"
        />

        <ComponentSpecCheckStatement
          isValid={inputsValid}
          validLabel="All inputs have Type and Description"
          invalidLabel="Missing Type or Description for inputs"
        >
          <Text tone="critical" size="xs">
            {invalidInputs.map((i) => i.name).join(", ")}
          </Text>
        </ComponentSpecCheckStatement>

        <ComponentSpecCheckStatement
          isValid={outputsValid}
          validLabel="All outputs have Type and Description"
          invalidLabel="Missing Type or Description for outputs"
        >
          <Text tone="critical" size="xs">
            {invalidOutputs.map((o) => o.name).join(", ")}
          </Text>
        </ComponentSpecCheckStatement>
      </BlockStack>
    </BlockStack>
  );
};

function checkComponentQuality(component: HydratedComponentReference) {
  const { spec: componentSpec } = component;

  // Check if all inputs have Type and Description
  const invalidInputs =
    componentSpec.inputs?.filter(
      (input) => !input.type || !input.description,
    ) ?? [];
  const inputsValid = invalidInputs.length === 0;

  // Check if all outputs have Type and Description
  const invalidOutputs =
    componentSpec.outputs?.filter(
      (output) => !output.type || !output.description,
    ) ?? [];
  const outputsValid = invalidOutputs.length === 0;

  // Check if component has a description
  const hasDescription = !!componentSpec.description;

  // Check if component has a name
  const hasName = !!component.name;

  return {
    hasName,
    hasDescription,
    inputsValid,
    outputsValid,
    invalidInputs,
    invalidOutputs,
  };
}

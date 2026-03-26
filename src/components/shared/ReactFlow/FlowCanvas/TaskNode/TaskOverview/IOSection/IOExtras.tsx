import type { GetExecutionArtifactsResponse } from "@/api/types.gen";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import type { InputSpec, OutputSpec } from "@/utils/componentSpec";

import IOCell from "./IOCell/IOCell";

interface IOExtrasProps {
  inputs?: InputSpec[];
  outputs?: OutputSpec[];
  artifacts: GetExecutionArtifactsResponse;
}

const IOExtras = ({ inputs, outputs, artifacts }: IOExtrasProps) => {
  const additionalInputs = Object.entries(
    artifacts.input_artifacts || {},
  ).filter(([key]) => !inputs?.some((input) => input.name === key));

  const additionalOutputs = Object.entries(
    artifacts.output_artifacts || {},
  ).filter(([key]) => !outputs?.some((output) => output.name === key));

  if (!additionalInputs.length && !additionalOutputs.length) {
    return null;
  }

  return (
    <>
      {additionalInputs.length > 0 && (
        <BlockStack gap="1" className="w-full">
          <Heading level={1}>Additional Input Artifacts</Heading>
          {additionalInputs.map(([key, artifact]) => (
            <IOCell key={key} name={key} artifact={artifact} />
          ))}
        </BlockStack>
      )}

      {additionalOutputs.length > 0 && (
        <BlockStack gap="1" className="w-full">
          <Heading level={1}>Additional Output Artifacts</Heading>
          {additionalOutputs.map(([key, artifact]) => (
            <IOCell key={key} name={key} artifact={artifact} />
          ))}
        </BlockStack>
      )}
    </>
  );
};

export default IOExtras;

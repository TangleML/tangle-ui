import type { GetExecutionArtifactsResponse } from "@/api/types.gen";
import { extractSecretName } from "@/components/shared/SecretsManagement/types";
import { Paragraph } from "@/components/ui/typography";
import {
  type InputSpec,
  isSecretArgument,
  type TaskSpec,
} from "@/utils/componentSpec";

import IOCell from "./IOCell/IOCell";
import IOCollapsibleSection from "./IOCollapsibleSection";

interface IOInputsProps {
  inputs?: InputSpec[];
  artifacts: GetExecutionArtifactsResponse;
  taskArguments?: TaskSpec["arguments"];
}

const IOInputs = ({ inputs, artifacts, taskArguments }: IOInputsProps) => {
  return (
    <IOCollapsibleSection title="Inputs" count={inputs?.length ?? 0}>
      {(!inputs || inputs.length === 0) && (
        <Paragraph tone="subdued" size="xs">
          No inputs defined
        </Paragraph>
      )}

      {inputs?.map((input) => {
        const inputArtifact = artifacts.input_artifacts?.[input.name];
        const argument = taskArguments?.[input.name];
        const secretName = isSecretArgument(argument)
          ? extractSecretName(argument)
          : null;

        return (
          <IOCell
            key={input.name}
            name={input.name}
            type={input.type?.toString()}
            artifact={inputArtifact}
            secretName={secretName}
          />
        );
      })}
    </IOCollapsibleSection>
  );
};

export default IOInputs;

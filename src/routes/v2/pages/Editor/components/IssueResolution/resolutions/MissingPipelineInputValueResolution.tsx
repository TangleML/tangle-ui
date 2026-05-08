import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { AutoGrowTextarea } from "@/routes/v2/pages/Editor/components/AutoGrowTextArea";
import { InputLabel } from "@/routes/v2/pages/Editor/components/InputLabel/InputLabel";
import { useIOActions } from "@/routes/v2/pages/Editor/store/actions/useIOActions";

import { InfoOnlyResolution } from "./InfoOnlyResolution";

export const MissingPipelineInputValueResolution = observer(
  function MissingPipelineInputValueResolution({
    issue,
    spec,
  }: {
    issue: ValidationIssue;
    spec: ComponentSpec;
  }) {
    const { track } = useAnalytics();
    const ioActions = useIOActions();

    if (!issue.entityId) {
      return (
        <InfoOnlyResolution message="Cannot resolve: missing pipeline input id." />
      );
    }

    const input = spec.inputs.find((i) => i.$id === issue.entityId);
    if (!input) {
      return (
        <InfoOnlyResolution message="Pipeline input not found in the current graph." />
      );
    }

    const entityId = issue.entityId;

    const handleDefaultValueChange = (value: string) => {
      const newDefault = value || undefined;
      if (newDefault !== input.defaultValue) {
        ioActions.setInputDefaultValue(spec, entityId, newDefault);
        track("v2.pipeline_editor.input_details.default_value.updated");
      }
    };

    return (
      <BlockStack gap="2">
        <Text size="xs" weight="semibold" className="text-gray-700">
          Set a default value for pipeline input &ldquo;{input.name}&rdquo;
        </Text>
        <BlockStack gap="2">
          <InputLabel
            htmlFor="resolution-input-default-value"
            onCopy={() => input.defaultValue}
          >
            Default value
          </InputLabel>
          <AutoGrowTextarea
            id="resolution-input-default-value"
            key={`${entityId}-default-value`}
            expandDialogTitle="Default Value"
            highlightSyntax={true}
            defaultValue={input.defaultValue}
            onChangeComplete={handleDefaultValueChange}
            placeholder="Default value"
            className="h-4 min-h-4 text-xs font-mono"
            data-testid="resolution-pipeline-input-default-value"
          />
        </BlockStack>
      </BlockStack>
    );
  },
);

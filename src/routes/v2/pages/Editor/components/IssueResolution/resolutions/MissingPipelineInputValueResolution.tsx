import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { InputLabel } from "@/routes/v2/pages/Editor/components/InputLabel/InputLabel";
import { useIOActions } from "@/routes/v2/pages/Editor/store/actions/useIOActions";
import { AutoGrowTextarea } from "@/routes/v2/shared/components/AutoGrowTextArea";

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

    const effectiveValue = input.value ?? input.defaultValue;

    const handleValueChange = (value: string) => {
      const newValue = value || undefined;
      if (newValue !== effectiveValue) {
        ioActions.setInputValue(spec, entityId, newValue);
        track("v2.pipeline_editor.input_details.default_value.updated");
      }
    };

    return (
      <BlockStack gap="2">
        <Text size="xs" weight="semibold" className="text-foreground">
          Set a value for pipeline input &ldquo;{input.name}&rdquo;
        </Text>
        <BlockStack gap="2">
          <InlineStack
            gap="2"
            blockAlign="center"
            align="space-between"
            className="w-full"
          >
            <InputLabel
              htmlFor="resolution-input-value"
              onCopy={() => effectiveValue}
            >
              Value
            </InputLabel>

            <InlineStack gap="1" blockAlign="center">
              <Icon
                name="SquareCheckBig"
                size="sm"
                className="text-muted-foreground"
              />
              <Text size="xs" tone="subdued">
                Use as default
              </Text>
            </InlineStack>
          </InlineStack>
          <AutoGrowTextarea
            id="resolution-input-value"
            key={`${entityId}-value`}
            expandDialogTitle="Value"
            highlightSyntax={true}
            defaultValue={effectiveValue}
            onChangeComplete={handleValueChange}
            placeholder="Value"
            className="h-4 min-h-4 text-xs font-mono"
            data-testid="resolution-pipeline-input-default-value"
          />
        </BlockStack>
      </BlockStack>
    );
  },
);

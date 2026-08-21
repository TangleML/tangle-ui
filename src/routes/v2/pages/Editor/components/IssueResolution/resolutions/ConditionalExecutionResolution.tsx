import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useValidationResolutionActions } from "@/routes/v2/pages/Editor/components/IssueResolution/useValidationResolutionActions";
import { findTaskById } from "@/routes/v2/pages/Editor/components/IssueResolution/validationResolution.utils";
import {
  describeConditionSource,
  resolveConditionalReference,
} from "@/utils/conditionalExecution";
import { tracking } from "@/utils/tracking";

import { InfoOnlyResolution } from "./InfoOnlyResolution";

export const ConditionalExecutionResolution = observer(
  function ConditionalExecutionResolution({
    issue,
    spec,
  }: {
    issue: ValidationIssue;
    spec: ComponentSpec;
  }) {
    const { removeConditionalExecution } = useValidationResolutionActions();

    if (!issue.entityId) {
      return (
        <InfoOnlyResolution message="Cannot resolve: missing task information." />
      );
    }

    const task = findTaskById(spec, issue.entityId);
    if (!task) {
      return (
        <InfoOnlyResolution message="Task not found in the current graph." />
      );
    }

    const conditionSource = describeConditionSource(
      resolveConditionalReference(task, spec),
    );

    return (
      <BlockStack gap="3">
        <BlockStack gap="2">
          <Text
            size="xs"
            weight="semibold"
            className="text-gray-700 dark:text-foreground"
          >
            Remove the run condition from &ldquo;{task.name}&rdquo;
          </Text>
          <Text size="xs" tone="subdued">
            Runs cannot be submitted while a subgraph is gated on a condition.
          </Text>
          {conditionSource && (
            <Text size="xs" tone="subdued">
              Current condition: {conditionSource}
            </Text>
          )}
        </BlockStack>

        <Button
          variant="outline"
          size="sm"
          {...tracking(
            "v2.pipeline_editor.pipeline_tree.resolution.remove_conditional_execution",
          )}
          onClick={() => removeConditionalExecution(spec, task)}
        >
          <Icon name="Unlink" size="xs" />
          Remove Condition
        </Button>
      </BlockStack>
    );
  },
);

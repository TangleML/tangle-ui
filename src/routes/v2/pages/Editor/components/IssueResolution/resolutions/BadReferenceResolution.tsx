import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { ArgumentRow } from "@/routes/v2/pages/Editor/components/ArgumentRow/ArgumentRow";
import { useValidationResolutionActions } from "@/routes/v2/pages/Editor/components/IssueResolution/useValidationResolutionActions";
import { findTaskById } from "@/routes/v2/pages/Editor/components/IssueResolution/validationResolution.utils";
import { tracking } from "@/utils/tracking";

import { InfoOnlyResolution } from "./InfoOnlyResolution";

export const BadReferenceResolution = observer(function BadReferenceResolution({
  issue,
  spec,
}: {
  issue: ValidationIssue;
  spec: ComponentSpec;
}) {
  const { unsetBadReference } = useValidationResolutionActions();

  if (!issue.entityId || !issue.argumentName) {
    return (
      <InfoOnlyResolution message="Cannot resolve: missing entity or argument information." />
    );
  }

  const entityId = issue.entityId;
  const argumentName = issue.argumentName;

  const task = findTaskById(spec, entityId);
  if (!task) {
    return (
      <InfoOnlyResolution message="Task not found in the current graph." />
    );
  }

  const componentSpec = task.resolvedComponentSpec;
  const inputSpec = componentSpec?.inputs?.find((i) => i.name === argumentName);

  const handleUnset = () => {
    unsetBadReference(task, spec, argumentName);
  };

  return (
    <BlockStack gap="3">
      <BlockStack gap="2">
        <Text size="xs" weight="semibold" tone="subdued">
          Fix reference for &ldquo;{argumentName}&rdquo; on task &ldquo;
          {task.name}&rdquo;
        </Text>
        <Text size="xs" tone="subdued">
          The current reference to &ldquo;{issue.referencedName}&rdquo; is
          invalid.
        </Text>
      </BlockStack>

      <Button
        variant="outline"
        size="sm"
        {...tracking(
          "v2.pipeline_editor.pipeline_tree.resolution.bad_reference_unset",
        )}
        onClick={handleUnset}
      >
        <Icon name="Unlink" size="xs" />
        Unset Argument
      </Button>

      {inputSpec && (
        <div className="border-t border-slate-200 pt-2">
          <Text size="xs" tone="subdued" className="mb-2">
            Or set a new value:
          </Text>
          <ArgumentRow
            inputSpec={inputSpec}
            currentValue={undefined}
            isSet={false}
            binding={undefined}
            task={task}
            spec={spec}
          />
        </div>
      )}
    </BlockStack>
  );
});

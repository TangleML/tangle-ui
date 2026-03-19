import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type {
  ComponentSpec,
  ComponentSpecJson,
  ValidationIssue,
} from "@/models/componentSpec";
import { ArgumentRow } from "@/routes/v2/pages/Editor/components/ArgumentRow";

import { unsetBadReference } from "../validationResolution.actions";
import { findTaskById } from "../validationResolution.utils";
import { InfoOnlyResolution } from "./InfoOnlyResolution";

export const BadReferenceResolution = observer(
  function BadReferenceResolution({
    issue,
    spec,
  }: {
    issue: ValidationIssue;
    spec: ComponentSpec;
  }) {
    if (!issue.entityId || !issue.argumentName) {
      return (
        <InfoOnlyResolution message="Cannot resolve: missing entity or argument information." />
      );
    }

    const task = findTaskById(spec, issue.entityId);
    if (!task) {
      return (
        <InfoOnlyResolution message="Task not found in the current graph." />
      );
    }

    const componentSpec = task.componentRef.spec as
      | ComponentSpecJson
      | undefined;
    const inputSpec = componentSpec?.inputs?.find(
      (i) => i.name === issue.argumentName,
    );

    const handleUnset = () => {
      unsetBadReference(task, spec, issue.argumentName!);
    };

    return (
      <BlockStack gap="3">
        <BlockStack gap="2">
          <Text size="xs" weight="semibold" className="text-gray-700">
            Fix reference for &ldquo;{issue.argumentName}&rdquo; on task &ldquo;
            {task.name}&rdquo;
          </Text>
          <Text size="xs" tone="subdued">
            The current reference to &ldquo;{issue.referencedName}&rdquo; is
            invalid.
          </Text>
        </BlockStack>

        <Button variant="outline" size="sm" onClick={handleUnset}>
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
  },
);

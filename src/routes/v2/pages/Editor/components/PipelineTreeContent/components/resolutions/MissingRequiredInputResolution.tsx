import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type {
  ComponentSpec,
  ComponentSpecJson,
  ValidationIssue,
} from "@/models/componentSpec";
import { ArgumentRow } from "@/routes/v2/pages/Editor/components/ArgumentRow";

import { findTaskById } from "../validationResolution.utils";
import { InfoOnlyResolution } from "./InfoOnlyResolution";

export const MissingRequiredInputResolution = observer(
  function MissingRequiredInputResolution({
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

    if (!inputSpec) {
      return (
        <InfoOnlyResolution message="Input specification not found for this argument." />
      );
    }

    const arg = task.arguments.find((a) => a.name === inputSpec.name);
    const binding = spec.bindings.find(
      (b) =>
        b.targetEntityId === task.$id && b.targetPortName === inputSpec.name,
    );

    return (
      <BlockStack gap="2">
        <Text size="xs" weight="semibold" className="text-gray-700">
          Set value for &ldquo;{inputSpec.name}&rdquo; on task &ldquo;
          {task.name}&rdquo;
        </Text>
        <ArgumentRow
          inputSpec={inputSpec}
          currentValue={arg?.value}
          isSet={arg !== undefined}
          binding={binding}
          task={task}
          spec={spec}
        />
      </BlockStack>
    );
  },
);

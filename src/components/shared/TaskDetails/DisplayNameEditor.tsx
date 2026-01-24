import { Activity, type ChangeEvent, type FocusEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  DISPLAY_NAME_MAX_LENGTH,
  getAnnotationValue,
  TASK_DISPLAY_NAME_ANNOTATION,
} from "@/utils/annotations";
import type { MetadataSpec } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

export const DisplayNameEditor = ({ taskId }: { taskId: string }) => {
  const { currentGraphSpec, updateGraphSpec } = useComponentSpec();

  const taskSpec = currentGraphSpec?.tasks[taskId];
  const componentRef = taskSpec?.componentRef;

  const initialName = getComponentName(componentRef);

  const currentDisplayName =
    getAnnotationValue(
      currentGraphSpec?.tasks[taskId]?.annotations,
      TASK_DISPLAY_NAME_ANNOTATION,
    ) ?? "";

  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(currentDisplayName);

  const handleOnChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newName = e.target.value;

    const validations = validate(newName);
    if (validations) {
      if (validations.errors.length > 0) {
        setError(validations.errors.join(" "));
      } else {
        setError(null);
      }

      if (validations.warnings.length > 0) {
        setWarning(validations.warnings.join(" "));
      } else {
        setWarning(null);
      }
    }

    setName(newName);
  };

  const handleOnBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    const name = e.target.value;

    if (name === currentDisplayName) {
      return;
    }

    if (!currentGraphSpec) {
      console.error("Cannot rename task: currentGraphSpec is undefined");
      return;
    }

    const annotations = taskSpec?.annotations || {};
    let updatedAnnotations: MetadataSpec["annotations"];

    if (name.trim() === "") {
      const { [TASK_DISPLAY_NAME_ANNOTATION]: _, ...rest } = annotations;
      updatedAnnotations = rest;
    } else {
      updatedAnnotations = {
        ...annotations,
        [TASK_DISPLAY_NAME_ANNOTATION]: name,
      };
    }

    const updatedTaskSpec = {
      ...taskSpec,
      annotations: updatedAnnotations,
    };

    const updatedGraphSpec = {
      ...currentGraphSpec,
      tasks: {
        ...currentGraphSpec.tasks,
        [taskId]: updatedTaskSpec,
      },
    };

    updateGraphSpec(updatedGraphSpec);
  };

  const validate = (value: string) => {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (value.trim().length === 0 && value !== currentDisplayName) {
      warnings.push(
        `Display name is empty. Default name "${name}" will be used.`,
      );
    }

    if (value.length > DISPLAY_NAME_MAX_LENGTH) {
      errors.push(
        `Display name is too long. Maximum length is ${DISPLAY_NAME_MAX_LENGTH} characters.`,
      );
    }

    return { warnings, errors };
  };

  return (
    <BlockStack gap="2">
      <Textarea
        value={name}
        onChange={handleOnChange}
        placeholder={initialName}
        onBlur={handleOnBlur}
        className="min-h-5 resize-y"
        autoFocus
      />
      <Activity mode={warning ? "visible" : "hidden"}>
        <InlineStack blockAlign="start" gap="1" wrap="nowrap">
          <Icon name="TriangleAlert" className="text-warning" />
          <Paragraph tone="warning" size="xs">
            {warning}
          </Paragraph>
        </InlineStack>
      </Activity>
      <Activity mode={error ? "visible" : "hidden"}>
        <Alert variant="destructive">
          <Icon name="CircleAlert" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Activity>
    </BlockStack>
  );
};

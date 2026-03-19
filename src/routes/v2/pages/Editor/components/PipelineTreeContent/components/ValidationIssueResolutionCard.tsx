import { observer } from "mobx-react-lite";
import { type ChangeEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type {
  ComponentSpec,
  ComponentSpecJson,
  Task,
  ValidationIssue,
} from "@/models/componentSpec";
import { ArgumentRow } from "@/routes/v2/pages/Editor/components/ArgumentRow";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { setSelectedValidationIssue } from "@/routes/v2/shared/store/editorStore";
import { navigationStore } from "@/routes/v2/shared/store/navigationStore";

import {
  deleteDuplicate,
  deleteEntity,
  renameDuplicate,
  renameEntity,
  unsetBadReference,
} from "./validationResolution.actions";

interface ValidationIssueResolutionCardProps {
  issue: ValidationIssue;
}

export const ValidationIssueResolutionCard = observer(
  function ValidationIssueResolutionCard({
    issue,
  }: ValidationIssueResolutionCardProps) {
    const spec = useSpec();
    if (!spec) return null;

    return (
      <BlockStack
        gap="3"
        className="p-3 h-full overflow-y-auto"
        data-testid="validation-resolution-card"
      >
        <IssueHeader issue={issue} />
        <ResolutionContent issue={issue} spec={spec} />
      </BlockStack>
    );
  },
);

function IssueHeader({ issue }: { issue: ValidationIssue }) {
  const severityColor =
    issue.severity === "error" ? "text-red-600" : "text-amber-600";
  const severityBg = issue.severity === "error" ? "bg-red-50" : "bg-amber-50";
  const severityIcon =
    issue.severity === "error" ? "CircleAlert" : "TriangleAlert";

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center">
        <Icon name={severityIcon} size="sm" className={severityColor} />
        <Text size="sm" weight="semibold" className={severityColor}>
          {issue.severity === "error" ? "Error" : "Warning"}
        </Text>
      </InlineStack>
      <div className={cn("rounded-md p-2", severityBg)}>
        <Text size="xs" className={severityColor}>
          {issue.message}
        </Text>
      </div>
    </BlockStack>
  );
}

interface ResolutionContentProps {
  issue: ValidationIssue;
  spec: ComponentSpec;
}

const ResolutionContent = observer(function ResolutionContent({
  issue,
  spec,
}: ResolutionContentProps) {
  switch (issue.issueCode) {
    case "MISSING_REQUIRED_INPUT":
      return <MissingRequiredInputResolution issue={issue} spec={spec} />;
    case "EMPTY_TASK_NAME":
      return (
        <RenameEntityResolution issue={issue} spec={spec} entityType="task" />
      );
    case "EMPTY_COMPONENT_NAME":
      return (
        <RenameEntityResolution
          issue={issue}
          spec={spec}
          entityType="component"
        />
      );
    case "EMPTY_INPUT_NAME":
      return (
        <RenameEntityResolution issue={issue} spec={spec} entityType="input" />
      );
    case "EMPTY_OUTPUT_NAME":
      return (
        <RenameEntityResolution issue={issue} spec={spec} entityType="output" />
      );
    case "DUPLICATE_INPUT_NAME":
      return (
        <DuplicateNameResolution issue={issue} spec={spec} entityType="input" />
      );
    case "DUPLICATE_OUTPUT_NAME":
      return (
        <DuplicateNameResolution
          issue={issue}
          spec={spec}
          entityType="output"
        />
      );
    case "MISSING_COMPONENT_REF":
      return (
        <DeleteEntityResolution
          issue={issue}
          label="Delete Task"
          onDelete={() => {
            if (issue.entityId) deleteEntity(spec, "task", issue.entityId);
            setSelectedValidationIssue(null);
          }}
        />
      );
    case "BAD_INPUT_REFERENCE":
    case "BAD_TASK_REFERENCE":
    case "BAD_OUTPUT_REFERENCE":
      return <BadReferenceResolution issue={issue} spec={spec} />;
    case "UNCONNECTED_INPUT":
      return (
        <DeleteEntityResolution
          issue={issue}
          label="Delete Input"
          onDelete={() => {
            if (issue.entityId) deleteEntity(spec, "input", issue.entityId);
            setSelectedValidationIssue(null);
          }}
        />
      );
    case "UNCONNECTED_OUTPUT":
      return (
        <DeleteEntityResolution
          issue={issue}
          label="Delete Output"
          onDelete={() => {
            if (issue.entityId) deleteEntity(spec, "output", issue.entityId);
            setSelectedValidationIssue(null);
          }}
        />
      );
    case "ORPHANED_BINDING_SOURCE":
    case "ORPHANED_BINDING_TARGET":
      return (
        <DeleteEntityResolution
          issue={issue}
          label="Delete Binding"
          onDelete={() => {
            if (issue.entityId) deleteEntity(spec, "binding", issue.entityId);
            setSelectedValidationIssue(null);
          }}
        />
      );
    case "CIRCULAR_DEPENDENCY":
      return (
        <InfoOnlyResolution message="Circular dependencies must be resolved manually by removing or re-routing connections between the affected tasks." />
      );
    case "NO_TASKS":
      return (
        <InfoOnlyResolution message="Add tasks to the pipeline from the component library." />
      );
    default:
      return (
        <InfoOnlyResolution message="No automated fix available for this issue." />
      );
  }
});

/**
 * Resolution for MISSING_REQUIRED_INPUT: renders the ArgumentRow for the
 * specific missing input so the user can type a value or use Quick Connect.
 */
const MissingRequiredInputResolution = observer(
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

/**
 * Resolution for empty name issues: renders a text input to set the name.
 */
function RenameEntityResolution({
  issue,
  spec,
  entityType,
}: {
  issue: ValidationIssue;
  spec: ComponentSpec;
  entityType: "task" | "input" | "output" | "component";
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    renameEntity(spec, entityType, issue.entityId, trimmed);
    setValue("");
    setSelectedValidationIssue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
  };

  const label = entityType === "component" ? "component" : entityType;

  return (
    <BlockStack gap="2">
      <Text size="xs" weight="semibold" className="text-gray-700">
        Set {label} name
      </Text>
      <InlineStack gap="2" blockAlign="end">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setValue(e.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${label} name...`}
          className="h-8 text-xs flex-1"
          autoFocus
        />
        <Button size="sm" onClick={handleSave} disabled={!value.trim()}>
          Save
        </Button>
      </InlineStack>
    </BlockStack>
  );
}

/**
 * Resolution for duplicate name issues: rename or delete.
 */
function DuplicateNameResolution({
  issue,
  spec,
  entityType,
}: {
  issue: ValidationIssue;
  spec: ComponentSpec;
  entityType: "input" | "output";
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    const trimmed = value.trim();
    if (!trimmed || !issue.entityId) return;

    renameDuplicate(spec, entityType, issue.entityId, trimmed);
    setValue("");
    setSelectedValidationIssue(null);
  };

  const handleDelete = () => {
    if (!issue.entityId) return;
    deleteDuplicate(spec, entityType, issue.entityId);
    setSelectedValidationIssue(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRename();
  };

  return (
    <BlockStack gap="3">
      <BlockStack gap="2">
        <Text size="xs" weight="semibold" className="text-gray-700">
          Rename {entityType}
        </Text>
        <InlineStack gap="2" blockAlign="end">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder={`New ${entityType} name...`}
            className="h-8 text-xs flex-1"
            autoFocus
          />
          <Button size="sm" onClick={handleRename} disabled={!value.trim()}>
            Rename
          </Button>
        </InlineStack>
      </BlockStack>

      <div className="border-t border-slate-200 pt-2">
        <Text size="xs" tone="subdued" className="mb-2">
          Or remove the duplicate:
        </Text>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Icon name="Trash2" size="xs" />
          Delete {entityType}
        </Button>
      </div>
    </BlockStack>
  );
}

/**
 * Resolution for bad reference issues: unset the argument or re-wire via Quick Connect.
 */
const BadReferenceResolution = observer(function BadReferenceResolution({
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

  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
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
});

/**
 * Resolution for issues that can be fixed by deleting an entity.
 */
function DeleteEntityResolution({
  issue,
  label,
  onDelete,
}: {
  issue: ValidationIssue;
  label: string;
  onDelete: () => void;
}) {
  return (
    <BlockStack gap="2">
      <Text size="xs" tone="subdued">
        This issue can be resolved by removing the entity.
      </Text>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={!issue.entityId}
      >
        <Icon name="Trash2" size="xs" />
        {label}
      </Button>
    </BlockStack>
  );
}

/**
 * Informational card for issues with no automated fix.
 */
function InfoOnlyResolution({ message }: { message: string }) {
  return (
    <InlineStack
      gap="2"
      blockAlign="start"
      className="rounded-md bg-slate-50 p-3"
    >
      <Icon name="Info" size="sm" className="text-slate-500 shrink-0 mt-0.5" />
      <Text size="xs" tone="subdued">
        {message}
      </Text>
    </InlineStack>
  );
}

function findTaskById(spec: ComponentSpec, entityId: string): Task | undefined {
  const directTask = spec.tasks.find((t) => t.$id === entityId);
  if (directTask) return directTask;

  for (const [, nestedSpec] of navigationStore.nestedSpecs) {
    const nestedTask = nestedSpec.tasks.find((t) => t.$id === entityId);
    if (nestedTask) return nestedTask;
  }
  return undefined;
}

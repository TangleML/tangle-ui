import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type {
  ComponentSpec,
  ValidationIssue,
  ValidationIssueCode,
} from "@/models/componentSpec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

import { BadReferenceResolution } from "./resolutions/BadReferenceResolution";
import { DeleteEntityResolution } from "./resolutions/DeleteEntityResolution";
import { DuplicateNameResolution } from "./resolutions/DuplicateNameResolution";
import { InfoOnlyResolution } from "./resolutions/InfoOnlyResolution";
import { MissingRequiredInputResolution } from "./resolutions/MissingRequiredInputResolution";
import { RenameEntityResolution } from "./resolutions/RenameEntityResolution";
import { useValidationResolutionActions } from "./useValidationResolutionActions";
import {
  validationIssueHeaderAccentVariants,
  validationIssueHeaderMessageBoxVariants,
  type ValidationIssueHeaderSeverity,
} from "./validationIssueHeader.variants";

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
  const severity: ValidationIssueHeaderSeverity =
    issue.severity === "error" ? "error" : "warning";
  const severityIcon =
    issue.severity === "error" ? "CircleAlert" : "TriangleAlert";

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center">
        <Icon
          name={severityIcon}
          size="sm"
          className={validationIssueHeaderAccentVariants({ severity })}
        />
        <Text
          size="xs"
          weight="semibold"
          className={validationIssueHeaderAccentVariants({ severity })}
        >
          {issue.severity === "error" ? "Error" : "Warning"}
        </Text>
      </InlineStack>
      <div className={validationIssueHeaderMessageBoxVariants({ severity })}>
        <Text
          size="xs"
          className={validationIssueHeaderAccentVariants({ severity })}
        >
          {issue.message}
        </Text>
      </div>
    </BlockStack>
  );
}

// ---------------------------------------------------------------------------
// Resolution lookup map — replaces a large switch to keep CC low.
// ---------------------------------------------------------------------------

type DeleteEntityType = "task" | "input" | "output" | "binding";
type RenameEntityType = "task" | "input" | "output" | "component";
type DuplicateEntityType = "input" | "output";

interface ResolutionResolverProps {
  issue: ValidationIssue;
  spec: ComponentSpec;
  deleteEntity: (
    spec: ComponentSpec,
    entityType: DeleteEntityType,
    entityId: string,
  ) => void;
}

type ResolutionResolver = (props: ResolutionResolverProps) => ReactNode;

function renderRenameResolution(
  entityType: RenameEntityType,
  { issue, spec }: ResolutionResolverProps,
): ReactNode {
  return (
    <RenameEntityResolution issue={issue} spec={spec} entityType={entityType} />
  );
}

function renderDuplicateNameResolution(
  entityType: DuplicateEntityType,
  { issue, spec }: ResolutionResolverProps,
): ReactNode {
  return (
    <DuplicateNameResolution
      issue={issue}
      spec={spec}
      entityType={entityType}
    />
  );
}

function renderDeleteResolution(
  label: string,
  entityType: DeleteEntityType,
  { issue, spec, deleteEntity }: ResolutionResolverProps,
): ReactNode {
  return (
    <DeleteEntityResolution
      issue={issue}
      label={label}
      onDelete={() => {
        if (issue.entityId) deleteEntity(spec, entityType, issue.entityId);
      }}
    />
  );
}

function renderBadRefResolution({
  issue,
  spec,
}: ResolutionResolverProps): ReactNode {
  return <BadReferenceResolution issue={issue} spec={spec} />;
}

function renderInfoResolution(message: string): ReactNode {
  return <InfoOnlyResolution message={message} />;
}

const RESOLUTION_MAP: Record<ValidationIssueCode, ResolutionResolver> = {
  MISSING_PIPELINE_INPUT_VALUE: () =>
    renderInfoResolution(
      "Set a default or pipeline value on this input in pipeline details, or mark the input as optional.",
    ),
  MISSING_REQUIRED_ANNOTATION: () =>
    renderInfoResolution(
      "Open the task and fill in the required launcher annotation in the task settings.",
    ),
  MISSING_REQUIRED_INPUT: (p) => (
    <MissingRequiredInputResolution issue={p.issue} spec={p.spec} />
  ),
  EMPTY_TASK_NAME: (p) => renderRenameResolution("task", p),
  EMPTY_COMPONENT_NAME: (p) => renderRenameResolution("component", p),
  EMPTY_INPUT_NAME: (p) => renderRenameResolution("input", p),
  EMPTY_OUTPUT_NAME: (p) => renderRenameResolution("output", p),
  DUPLICATE_INPUT_NAME: (p) => renderDuplicateNameResolution("input", p),
  DUPLICATE_OUTPUT_NAME: (p) => renderDuplicateNameResolution("output", p),
  MISSING_COMPONENT_REF: (p) =>
    renderDeleteResolution("Delete Task", "task", p),
  BAD_INPUT_REFERENCE: renderBadRefResolution,
  BAD_TASK_REFERENCE: renderBadRefResolution,
  BAD_OUTPUT_REFERENCE: renderBadRefResolution,
  UNCONNECTED_INPUT: (p) => renderDeleteResolution("Delete Input", "input", p),
  UNCONNECTED_OUTPUT: (p) =>
    renderDeleteResolution("Delete Output", "output", p),
  ORPHANED_BINDING_SOURCE: (p) =>
    renderDeleteResolution("Delete Binding", "binding", p),
  ORPHANED_BINDING_TARGET: (p) =>
    renderDeleteResolution("Delete Binding", "binding", p),
  CIRCULAR_DEPENDENCY: () =>
    renderInfoResolution(
      "Circular dependencies must be resolved manually by removing or re-routing connections between the affected tasks.",
    ),
  NO_TASKS: () =>
    renderInfoResolution(
      "Add tasks to the pipeline from the component library.",
    ),
};

interface ResolutionContentProps {
  issue: ValidationIssue;
  spec: ComponentSpec;
}

const ResolutionContent = observer(function ResolutionContent({
  issue,
  spec,
}: ResolutionContentProps) {
  const { deleteEntity } = useValidationResolutionActions();
  const resolve = issue.issueCode ? RESOLUTION_MAP[issue.issueCode] : undefined;
  if (!resolve) {
    return (
      <>{renderInfoResolution("No automated fix available for this issue.")}</>
    );
  }
  return <>{resolve({ issue, spec, deleteEntity })}</>;
});

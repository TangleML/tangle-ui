import { observer } from "mobx-react-lite";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpec, ValidationIssue } from "@/models/componentSpec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { setSelectedValidationIssue } from "@/routes/v2/shared/store/editorStore";

import { BadReferenceResolution } from "./resolutions/BadReferenceResolution";
import { DeleteEntityResolution } from "./resolutions/DeleteEntityResolution";
import { DuplicateNameResolution } from "./resolutions/DuplicateNameResolution";
import { InfoOnlyResolution } from "./resolutions/InfoOnlyResolution";
import { MissingRequiredInputResolution } from "./resolutions/MissingRequiredInputResolution";
import { RenameEntityResolution } from "./resolutions/RenameEntityResolution";
import { deleteEntity } from "./validationResolution.actions";

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

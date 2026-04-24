type ValidationIssueType = "graph" | "task" | "input" | "output";

type ValidationSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "MISSING_REQUIRED_INPUT"
  | "EMPTY_TASK_NAME"
  | "MISSING_COMPONENT_REF"
  | "BAD_INPUT_REFERENCE"
  | "BAD_TASK_REFERENCE"
  | "BAD_OUTPUT_REFERENCE"
  | "CIRCULAR_DEPENDENCY"
  | "EMPTY_INPUT_NAME"
  | "DUPLICATE_INPUT_NAME"
  | "UNCONNECTED_INPUT"
  | "EMPTY_OUTPUT_NAME"
  | "DUPLICATE_OUTPUT_NAME"
  | "UNCONNECTED_OUTPUT"
  | "EMPTY_COMPONENT_NAME"
  | "NO_TASKS"
  | "ORPHANED_BINDING_SOURCE"
  | "ORPHANED_BINDING_TARGET";

export interface ValidationIssue {
  type: ValidationIssueType;
  message: string;
  entityId?: string;
  severity: ValidationSeverity;
  issueCode?: ValidationIssueCode;
  argumentName?: string;
  referencedName?: string;
}

export interface ComponentValidationIssue extends ValidationIssue {
  id: string;
  subgraphPath: string[];
  /** Name of the entity (task/input/output) for cross-spec lookup. */
  entityName?: string;
}

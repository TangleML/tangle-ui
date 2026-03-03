export type ValidationIssueType = "graph" | "task" | "input" | "output";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  type: ValidationIssueType;
  message: string;
  entityId?: string;
  severity: ValidationSeverity;
}

export interface ComponentValidationIssue extends ValidationIssue {
  id: string;
  subgraphPath: string[];
}

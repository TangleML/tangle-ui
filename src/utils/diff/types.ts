import type { ArgumentType, ComponentSpec } from "@/utils/componentSpec";

/**
 * Represents the data needed to compare runs
 */
export interface RunComparisonData {
  runId: string;
  pipelineName: string;
  createdAt: string;
  createdBy?: string;
  status?: string;
  arguments?: Record<string, ArgumentType>;
  componentSpec?: ComponentSpec;
}

/**
 * Change type for diff items
 */
export type ChangeType = "added" | "removed" | "modified" | "unchanged";

/**
 * Represents a single value difference between runs
 */
export interface ValueDiff {
  key: string;
  values: (string | undefined)[];
  changeType: ChangeType;
}

/**
 * Represents metadata differences between runs
 */
export interface MetadataDiff {
  createdAt: ValueDiff;
  createdBy: ValueDiff;
  status: ValueDiff;
}

/**
 * Represents differences in a task between runs
 */
export interface TaskDiff {
  taskId: string;
  changeType: ChangeType;
  digestDiff?: ValueDiff;
  componentNameDiff?: ValueDiff;
  argumentsDiff: ValueDiff[];
}

/**
 * Complete diff result between multiple runs
 */
export interface RunDiffResult {
  runIds: string[];
  metadata: MetadataDiff;
  arguments: ValueDiff[];
  tasks: {
    added: string[];
    removed: string[];
    modified: TaskDiff[];
    unchanged: string[];
  };
  summary: {
    totalArgumentChanges: number;
    totalTaskChanges: number;
    hasChanges: boolean;
  };
}

/**
 * A simplified task representation for comparison
 */
export interface TaskForComparison {
  taskId: string;
  componentName?: string;
  componentDigest?: string;
  arguments: Record<string, ArgumentType>;
}


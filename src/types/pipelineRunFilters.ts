import type { ContainerExecutionStatus } from "@/api/types.gen";

/**
 * Filter for annotation key-value pairs.
 * If value is omitted, matches any run with this annotation key.
 */
export interface AnnotationFilter {
  key: string;
  value?: string;
}

/**
 * Filters for searching and filtering pipeline runs.
 * All filters combine with AND logic.
 */
export interface PipelineRunFilters {
  status?: ContainerExecutionStatus;
  created_by?: string;
  created_after?: string; // ISO datetime
  created_before?: string; // ISO datetime
  pipeline_name?: string;
  annotations?: AnnotationFilter[];
  sort_field?: "created_at" | "pipeline_name";
  sort_direction?: "asc" | "desc";
}

export type SortField = NonNullable<PipelineRunFilters["sort_field"]>;

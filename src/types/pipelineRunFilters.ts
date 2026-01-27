import type { ContainerExecutionStatus } from "@/api/types.gen";

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
}

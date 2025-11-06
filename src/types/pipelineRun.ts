/**
 * Possible status values for a pipeline run, derived from aggregating task statuses
 */
export type RunStatus =
  | "FAILED"
  | "RUNNING"
  | "SUCCEEDED"
  | "WAITING"
  | "CANCELLED"
  | "UNKNOWN";

export interface PipelineRun {
  id: number;
  root_execution_id: number;
  created_at: string;
  created_by: string;
  pipeline_name: string;
  pipeline_digest?: string;
  status?: RunStatus;
  statusCounts?: TaskStatusCounts;
}

export interface TaskStatusCounts {
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  waiting: number;
  skipped: number;
  cancelled: number;
}

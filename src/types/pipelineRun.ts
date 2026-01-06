export interface PipelineRun {
  id: number;
  root_execution_id: number;
  created_at: string;
  created_by: string;
  pipeline_name: string;
  pipeline_digest?: string;
  status?: string;
  statusCounts?: TaskStatusCounts;
}

export interface TaskStatusCounts {
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  pending: number;
  waiting: number;
  skipped: number;
  cancelled: number;
}

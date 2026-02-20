import { z } from "zod";

export const TaskStatusCountsSchema = z.object({
  total: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  running: z.number(),
  pending: z.number(),
  waiting: z.number(),
  skipped: z.number(),
  cancelled: z.number(),
});

export const PipelineRunSchema = z.object({
  id: z.number(),
  root_execution_id: z.number(),
  created_at: z.string(),
  created_by: z.string(),
  pipeline_name: z.string(),
  pipeline_description: z.string().optional(),
  pipeline_digest: z.string().optional(),
  status: z.string().optional(),
  statusCounts: TaskStatusCountsSchema.optional(),
});

export type PipelineRun = z.infer<typeof PipelineRunSchema>;
export type TaskStatusCounts = z.infer<typeof TaskStatusCountsSchema>;

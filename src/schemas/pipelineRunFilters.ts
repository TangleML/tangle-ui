import { z } from "zod";

import { ContainerExecutionStatusSchema } from "./api";

export const AnnotationFilterSchema = z.object({
  key: z.string(),
  value: z.string().optional(),
});

export const PipelineRunFiltersSchema = z.object({
  status: ContainerExecutionStatusSchema.optional(),
  created_by: z.string().optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  pipeline_name: z.string().optional(),
  annotations: z.array(AnnotationFilterSchema).optional(),
});

export type AnnotationFilter = z.infer<typeof AnnotationFilterSchema>;
export type PipelineRunFilters = z.infer<typeof PipelineRunFiltersSchema>;

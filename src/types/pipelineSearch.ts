import type { AnnotationFilter } from "@/types/pipelineRunFilters";

export type PipelineAnnotationFilter = AnnotationFilter;

export type RemotePipelineSortField = "updated_at" | "name";
export type RemotePipelineSortDirection = "asc" | "desc";

export interface PipelineSearchFilters {
  searchQuery?: string;
  userId?: string;
  modifiedAfter?: string; // ISO datetime, inclusive.
  modifiedBefore?: string; // ISO datetime, exclusive.
  annotations?: PipelineAnnotationFilter[];
  sortField?: RemotePipelineSortField;
  sortDirection?: RemotePipelineSortDirection;
}

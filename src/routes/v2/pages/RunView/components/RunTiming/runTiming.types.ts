import type {
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
} from "@/api/types.gen";

export type RunTimingPhaseName = "startup" | "runtime";
export type RunTimingQuality = "complete" | "partial" | "unavailable";
export type RunTimingCacheState = "hit" | "miss" | "unknown";

export interface RunTimingPhase {
  name: RunTimingPhaseName;
  startAt: number;
  endAt: number;
  durationMs: number;
}

export interface RunTimingTaskSource {
  executionId: string;
  parentExecutionId: string;
  taskId: string;
  navigationPath: string[];
  depth: number;
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  details?: GetExecutionInfoResponse;
  containerState?: GetContainerExecutionStateResponse;
  isSubgraph: boolean;
  loadFailed?: boolean;
}

export interface RunTimingTask {
  executionId: string;
  parentExecutionId: string;
  taskId: string;
  taskName: string;
  navigationPath: string[];
  depth: number;
  dependencyExecutionIds: string[];
  componentName?: string;
  componentDigest?: string;
  isSubgraph: boolean;
  status?: string;
  phases: RunTimingPhase[];
  readyAt?: number;
  startAt?: number;
  endAt?: number;
  durationMs?: number;
  historicalRuntimeMs?: number;
  cacheState: RunTimingCacheState;
  timingQuality: RunTimingQuality;
}

export interface RunTimingMetrics {
  wallClockDurationMs?: number;
  totalTaskCount: number;
  cachedTaskCount: number;
  averageStartupMs?: number;
  startupCoverage: number;
  busyRuntimeMs: number;
  busyPercent: number;
  criticalPathDurationMs?: number;
}

export interface RunTimingData {
  tasks: RunTimingTask[];
  truncated: boolean;
  rangeStart?: number;
  rangeEnd?: number;
  criticalPathExecutionIds: Set<string>;
  metrics: RunTimingMetrics;
}

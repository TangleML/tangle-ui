/**
 * Contract for the worker → main-thread tool bridge.
 *
 * The worker invokes these methods via a Comlink-proxied implementation;
 * the main thread implements them in `toolBridge.ts` by calling editor
 * actions on the live MobX spec inside an undo group. Both sides import
 * this file purely for types — there is no runtime code here.
 *
 * Method signatures intentionally mirror the CSOM tool surface so each
 * `csomTools.ts` tool is a one-line wrapper. Result shapes carry a
 * `success` flag plus contextual ids so the model can chain calls
 * (e.g. take the returned `taskId` and call `set_task_argument`).
 */
import type {
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
  GetGraphExecutionStateResponse,
  PipelineRunResponse,
} from "@/api/types.gen";
import type { ArgumentType, ComponentReference } from "@/models/componentSpec";
import type { AiSpec } from "@/routes/v2/shared/components/AiChat/serializeSpecForAi";

interface ValidationIssue {
  type: string;
  severity: string;
  message: string;
  entityId?: string;
  entityName?: string;
  issueCode?: string;
  subgraphPath: string[];
}

export interface ValidationResult {
  valid: boolean;
  issueCount: number;
  issues: ValidationIssue[];
}

interface BridgeResult {
  success: boolean;
  error?: string;
}

export interface ConnectArgs {
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

export interface RunSubmissionResult {
  success: boolean;
  runId?: string;
  rootExecutionId?: string;
  error?: string;
}

export interface ContainerLogPayload {
  log_text?: string;
  system_error_exception_full?: string;
  orchestration_error_message?: string;
  truncated?: boolean;
}

export interface RunDebugSnapshotChild {
  taskId: string;
  executionId: string;
  status?: string;
  details?: GetExecutionInfoResponse;
  containerState?: GetContainerExecutionStateResponse;
  log?: ContainerLogPayload;
  error?: string;
}

export interface RunDebugSnapshot {
  success: boolean;
  run?: PipelineRunResponse;
  rootExecutionId?: string;
  rootStatus?: string;
  failedChildren: RunDebugSnapshotChild[];
  truncatedChildren: number;
  error?: string;
}

interface SearchComponentsArgs {
  query: string;
  limit?: number;
}

interface ComponentSearchBridgeResult {
  id: string;
  name: string;
  description: string;
  source: string;
  matchedFields: string[];
  inputs: string[];
  outputs: string[];
  componentRef: Pick<ComponentReference, "name" | "url" | "spec">;
  yamlText: string | null;
}

interface SearchComponentsResult {
  success: boolean;
  results: ComponentSearchBridgeResult[];
  error?: string;
}

export type RunDetails = PipelineRunResponse;
export type ExecutionDetails = GetExecutionInfoResponse;
export type ExecutionState = GetGraphExecutionStateResponse;
export type ContainerState = GetContainerExecutionStateResponse;

export interface SubgraphStateResult {
  success: boolean;
  spec?: AiSpec;
  error?: string;
}

export interface ToolBridgeApi {
  getPipelineState(): Promise<AiSpec>;
  getSubgraphState(taskEntityId: string): Promise<SubgraphStateResult>;

  setPipelineName(name: string): Promise<BridgeResult>;
  setPipelineDescription(description: string): Promise<BridgeResult>;

  addTask(args: {
    name: string;
    componentRef: ComponentReference;
    inSubgraphTaskId?: string;
  }): Promise<BridgeResult & { taskId?: string; name?: string }>;
  deleteTask(entityId: string): Promise<BridgeResult>;
  renameTask(entityId: string, newName: string): Promise<BridgeResult>;

  addInput(args: {
    name: string;
    type?: string;
    description?: string;
    defaultValue?: string;
    optional?: boolean;
    inSubgraphTaskId?: string;
  }): Promise<BridgeResult & { inputId?: string; name?: string }>;
  deleteInput(entityId: string): Promise<BridgeResult>;
  renameInput(entityId: string, newName: string): Promise<BridgeResult>;

  addOutput(args: {
    name: string;
    type?: string;
    description?: string;
    inSubgraphTaskId?: string;
  }): Promise<BridgeResult & { outputId?: string; name?: string }>;
  deleteOutput(entityId: string): Promise<BridgeResult>;
  renameOutput(entityId: string, newName: string): Promise<BridgeResult>;

  connectNodes(
    args: ConnectArgs,
  ): Promise<BridgeResult & { bindingId?: string }>;
  deleteEdge(entityId: string): Promise<BridgeResult>;

  setTaskArgument(
    taskEntityId: string,
    inputName: string,
    value: ArgumentType,
  ): Promise<BridgeResult>;

  createSubgraph(
    taskEntityIds: string[],
    subgraphName: string,
  ): Promise<BridgeResult & { subgraphTaskId?: string }>;
  unpackSubgraph(taskEntityId: string): Promise<BridgeResult>;

  autoLayout(): Promise<BridgeResult>;

  validatePipeline(): Promise<ValidationResult>;

  searchComponents(args: SearchComponentsArgs): Promise<SearchComponentsResult>;

  submitPipelineRun(): Promise<RunSubmissionResult>;
  getRunDetails(runId: string): Promise<RunDetails>;
  getExecutionDetails(executionId: string): Promise<ExecutionDetails>;
  getExecutionState(executionId: string): Promise<ExecutionState>;
  getContainerState(executionId: string): Promise<ContainerState>;
  getContainerLog(executionId: string): Promise<ContainerLogPayload>;
  debugPipelineRun(runId: string): Promise<RunDebugSnapshot>;
}

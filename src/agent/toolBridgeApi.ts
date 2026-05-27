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
import type { ComponentReference } from "@/models/componentSpec";
import type { AiSpec } from "@/routes/v2/pages/Editor/components/AiChat/serializeSpecForAi";

interface ValidationIssue {
  type: string;
  severity: string;
  message: string;
  entityId?: string;
  issueCode?: string;
}

export interface ValidationResult {
  valid: boolean;
  issueCount: number;
  issues: ValidationIssue[];
}

export interface ConnectArgs {
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

export interface ToolBridgeApi {
  getPipelineState(): Promise<AiSpec>;

  setPipelineName(name: string): Promise<{ success: boolean }>;
  setPipelineDescription(description: string): Promise<{ success: boolean }>;

  addTask(args: { name: string; componentRef: ComponentReference }): Promise<{
    success: boolean;
    taskId?: string;
    name?: string;
    error?: string;
  }>;
  deleteTask(entityId: string): Promise<{ success: boolean }>;
  renameTask(entityId: string, newName: string): Promise<{ success: boolean }>;

  addInput(args: {
    name: string;
    type?: string;
    description?: string;
    defaultValue?: string;
    optional?: boolean;
  }): Promise<{ success: boolean; inputId: string; name: string }>;
  deleteInput(entityId: string): Promise<{ success: boolean }>;
  renameInput(entityId: string, newName: string): Promise<{ success: boolean }>;

  addOutput(args: {
    name: string;
    type?: string;
    description?: string;
  }): Promise<{ success: boolean; outputId: string; name: string }>;
  deleteOutput(entityId: string): Promise<{ success: boolean }>;
  renameOutput(
    entityId: string,
    newName: string,
  ): Promise<{ success: boolean }>;

  connectNodes(
    args: ConnectArgs,
  ): Promise<{ success: boolean; bindingId?: string; error?: string }>;
  deleteEdge(entityId: string): Promise<{ success: boolean }>;

  setTaskArgument(
    taskEntityId: string,
    inputName: string,
    value: string,
  ): Promise<{ success: boolean }>;

  createSubgraph(
    taskEntityIds: string[],
    subgraphName: string,
  ): Promise<{ success: boolean; subgraphTaskId?: string; error?: string }>;
  unpackSubgraph(taskEntityId: string): Promise<{ success: boolean }>;

  validatePipeline(): Promise<ValidationResult>;
}

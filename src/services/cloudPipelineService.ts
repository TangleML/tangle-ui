import { z } from "zod";

import { client } from "@/api/client.gen";
import { getCurrentUserApiUsersMeGet } from "@/api/sdk.gen";
import { getArgumentsFromInputs } from "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs";
import { coerceMetadataAnnotations } from "@/utils/coerceMetadataAnnotations";
import {
  type ArgumentType,
  type ComponentSpec,
  type DynamicDataArgument,
  isValidComponentSpec,
} from "@/utils/componentSpec";
import { isRecord } from "@/utils/typeGuards";

const USER_PIPELINES_PATH = "/api/users/me/pipelines";
const PIPELINE_BY_ID_PATH = "/api/pipelines/{pipeline_id}";

const accountSchema = z.object({
  id: z.string().min(1),
  permissions: z.array(z.string()),
});
const pipelineSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().min(1),
  file_path: z.string().min(1),
  pipeline_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  current_version: z.string(),
  versioning_mode: z.enum(["disabled", "full"]),
});
const pipelineSchema = pipelineSummarySchema.extend({
  version: z.string(),
  version_created_at: z.string(),
  root_pipeline_task: z.record(z.string(), z.unknown()),
  pipeline_run_annotations: z.record(z.string(), z.string()),
});
const pipelineListSchema = z.object({
  pipelines: z.array(pipelineSummarySchema),
  next_page_token: z.string().min(1).nullable(),
  total_count: z.number().int().nonnegative().optional(),
});

export interface CloudConnection {
  backendUrl: string;
  authorizationToken?: string;
  signal?: AbortSignal;
  account?: CloudPipelineAccount;
}

export interface CloudPipelineAccount extends z.infer<typeof accountSchema> {}

export interface CloudPipelineSummary extends z.infer<
  typeof pipelineSummarySchema
> {}

export interface CloudPipeline extends z.infer<typeof pipelineSchema> {}

export interface CloudPipelinePageOptions {
  pageSize?: number;
  pageToken?: string;
}

export interface CloudPipelinePage {
  pipelines: CloudPipelineSummary[];
  nextPageToken?: string;
  totalCount?: number;
}

interface WriteCloudPipelineOptions {
  filePath: string;
  componentSpec: ComponentSpec;
  existingPipeline?: CloudPipeline;
  sourcePipeline?: CloudPipeline;
}

function requestOptions(connection: CloudConnection) {
  const timeout = AbortSignal.timeout(15_000);
  return {
    baseUrl: connection.backendUrl.replace(/\/+$/, ""),
    headers: connection.authorizationToken
      ? { Authorization: `Bearer ${connection.authorizationToken}` }
      : undefined,
    signal: connection.signal
      ? AbortSignal.any([connection.signal, timeout])
      : timeout,
  };
}

function requireSuccessfulResponse(result: {
  response: Response;
  error?: unknown;
}) {
  if (result.response.ok) return;
  const detail = isRecord(result.error) ? result.error.detail : undefined;
  throw new Error(
    typeof detail === "string"
      ? detail
      : `Cloud request failed (${result.response.status}).`,
  );
}

export async function getCloudPipelineAccount(
  connection: CloudConnection,
): Promise<CloudPipelineAccount> {
  const result = await getCurrentUserApiUsersMeGet(requestOptions(connection));
  requireSuccessfulResponse(result);
  const account = accountSchema.safeParse(result.data);
  if (!account.success) {
    throw new Error("The backend could not identify your account.");
  }
  return account.data;
}

export async function listCloudPipelinePage(
  connection: CloudConnection,
  { pageSize = 10, pageToken }: CloudPipelinePageOptions = {},
): Promise<CloudPipelinePage> {
  const result = await client.get<unknown>({
    ...requestOptions(connection),
    url: `${USER_PIPELINES_PATH}/all`,
    query: { page_size: pageSize, page_token: pageToken },
  });
  requireSuccessfulResponse(result);
  const page = pipelineListSchema.parse(result.data);
  return {
    pipelines: page.pipelines,
    nextPageToken: page.next_page_token ?? undefined,
    totalCount: page.total_count,
  };
}

export async function listCloudPipelines(
  connection: CloudConnection,
): Promise<CloudPipelineSummary[]> {
  const pipelines = new Map<string, CloudPipelineSummary>();
  const pageTokens = new Set<string>();
  let pageToken: string | undefined;

  do {
    const page = await listCloudPipelinePage(connection, {
      pageSize: 100,
      pageToken,
    });
    for (const pipeline of page.pipelines) {
      // A concurrent save can move a row between cursor pages.
      if (!pipelines.has(pipeline.id)) pipelines.set(pipeline.id, pipeline);
    }
    pageToken = page.nextPageToken;
    if (pageToken) {
      if (pageTokens.has(pageToken)) {
        throw new Error("The backend repeated a pipeline list page.");
      }
      pageTokens.add(pageToken);
    }
  } while (pageToken);

  return [...pipelines.values()];
}

export async function getCloudPipeline(
  pipelineId: string,
  connection: CloudConnection,
): Promise<CloudPipeline> {
  const result = await client.get<unknown>({
    ...requestOptions(connection),
    url: PIPELINE_BY_ID_PATH,
    path: { pipeline_id: pipelineId },
  });
  requireSuccessfulResponse(result);
  const pipeline = pipelineSchema.parse(result.data);
  if (pipeline.id !== pipelineId) {
    throw new Error("The backend returned a different remote pipeline.");
  }
  return pipeline;
}

export async function writeCloudPipeline(
  {
    filePath,
    componentSpec,
    existingPipeline,
    sourcePipeline,
  }: WriteCloudPipelineOptions,
  connection: CloudConnection,
): Promise<CloudPipeline> {
  const account =
    connection.account ?? (await getCloudPipelineAccount(connection));
  requireWritePermission(account, existingPipeline);
  if (existingPipeline && existingPipeline.file_path !== filePath) {
    throw new Error("A remote pipeline's storage path cannot change.");
  }

  const template = existingPipeline ?? sourcePipeline;
  const task = componentSpecToCloudTask(componentSpec, template);
  const result = await client.put<unknown>({
    ...requestOptions(connection),
    url: USER_PIPELINES_PATH,
    query: { file_path: filePath },
    body: {
      root_pipeline_task: task,
      pipeline_run_annotations: template?.pipeline_run_annotations ?? {},
    },
  });
  requireSuccessfulResponse(result);
  const savedPipeline = pipelineSchema.parse(result.data);
  if (
    savedPipeline.user_id !== account.id ||
    savedPipeline.file_path !== filePath ||
    (existingPipeline && savedPipeline.id !== existingPipeline.id)
  ) {
    throw new Error("The backend returned a different remote pipeline.");
  }
  return savedPipeline;
}

export async function deleteCloudPipeline(
  pipeline: CloudPipelineSummary,
  connection: CloudConnection,
): Promise<void> {
  const account =
    connection.account ?? (await getCloudPipelineAccount(connection));
  requireWritePermission(account, pipeline);
  const result = await client.delete<unknown>({
    ...requestOptions(connection),
    url: USER_PIPELINES_PATH,
    query: { file_path: pipeline.file_path },
  });
  requireSuccessfulResponse(result);
}

function requireWritePermission(
  account: CloudPipelineAccount,
  pipeline?: CloudPipelineSummary,
) {
  if (pipeline && pipeline.user_id !== account.id) {
    throw new Error("Only the owner can change this remote pipeline.");
  }
  if (!account.permissions.includes("write")) {
    throw new Error("Your account does not have permission to save pipelines.");
  }
}

export function cloudPipelineToComponentSpec(
  pipeline: CloudPipeline,
): ComponentSpec {
  const root = pipeline.root_pipeline_task;
  const ref = root.componentRef;
  if (!isRecord(ref) || !isValidComponentSpec(ref.spec)) {
    throw new Error(
      "The remote pipeline does not contain a component definition.",
    );
  }
  const componentSpec = structuredClone(ref.spec);
  for (const input of componentSpec.inputs ?? []) {
    delete input.value;
    const argument = isRecord(root.arguments)
      ? root.arguments[input.name]
      : undefined;
    if (typeof argument === "string") input.value = argument;
  }
  return componentSpec;
}

/**
 * Returns dynamic root arguments that the string-only pipeline editor cannot
 * represent. These values need to be supplied again when the pipeline runs.
 */
export function getCloudPipelineSavedTaskArguments(
  pipeline: CloudPipeline,
): Record<string, ArgumentType> {
  const root = pipeline.root_pipeline_task;
  const ref = root.componentRef;
  if (
    !isRecord(ref) ||
    !isValidComponentSpec(ref.spec) ||
    !isRecord(root.arguments)
  ) {
    return {};
  }

  const argumentsByName: Record<string, ArgumentType> = {};
  for (const input of ref.spec.inputs ?? []) {
    const argument = root.arguments[input.name];
    if (isSavedDynamicArgument(argument)) {
      argumentsByName[input.name] = structuredClone(argument);
    }
  }
  return argumentsByName;
}

function isSavedDynamicArgument(
  argument: unknown,
): argument is DynamicDataArgument {
  if (!isRecord(argument) || !isRecord(argument.dynamicData)) return false;

  const values = Object.values(argument.dynamicData);
  if (values.length === 0 || !values.every(isRecord)) return false;

  const secret = argument.dynamicData.secret;
  return (
    secret === undefined ||
    (isRecord(secret) && typeof secret.name === "string")
  );
}

function componentSpecToCloudTask(
  componentSpec: ComponentSpec,
  existingPipeline?: CloudPipeline,
): Record<string, unknown> {
  const spec = structuredClone(componentSpec);
  const previousTask = existingPipeline?.root_pipeline_task;
  const taskArguments: Record<string, unknown> = getArgumentsFromInputs(spec);

  // Secret and system arguments cannot be represented by the editor's string inputs.
  if (isRecord(previousTask?.arguments)) {
    for (const input of spec.inputs ?? []) {
      const previousArgument = previousTask.arguments[input.name];
      if (
        input.value === undefined &&
        previousArgument !== undefined &&
        typeof previousArgument !== "string"
      ) {
        taskArguments[input.name] = structuredClone(previousArgument);
      }
    }
  }

  removeEditorFields(spec);
  coerceMetadataAnnotations(spec);
  return {
    ...structuredClone(previousTask),
    componentRef: { spec },
    arguments: taskArguments,
  };
}

function removeEditorFields(spec: ComponentSpec) {
  for (const input of spec.inputs ?? []) {
    delete input.value;
  }
  if ("graph" in spec.implementation) {
    for (const task of Object.values(spec.implementation.graph.tasks)) {
      // Only the API's ComponentReference fields belong in a saved task.
      const {
        name,
        digest,
        tag,
        url,
        text,
        spec: nestedSpec,
      } = task.componentRef;
      task.componentRef = { name, digest, tag, url, text, spec: nestedSpec };
      if (nestedSpec) removeEditorFields(nestedSpec);
    }
  }
}

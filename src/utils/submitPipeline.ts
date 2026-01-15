import type {
  BodyCreateApiPipelineRunsPost,
  ComponentSpecInput,
  TaskSpecOutput,
} from "@/api/types.gen";
import { processTemplate } from "@/components/shared/PipelineRunNameTemplate/processTemplate";
import { getRunNameTemplate } from "@/components/shared/PipelineRunNameTemplate/utils";
import { getArgumentsFromInputs } from "@/components/shared/ReactFlow/FlowCanvas/utils/getArgumentsFromInputs";
import {
  createPipelineRun,
  savePipelineRun,
} from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { buildAnnotationsWithCanonicalName } from "./canonicalPipelineName";
import type { ComponentReference, ComponentSpec } from "./componentSpec";
import { extractTaskArguments } from "./nodes/taskArguments";
import { componentSpecFromYaml } from "./yaml";

export async function submitPipelineRun(
  componentSpec: ComponentSpec,
  backendUrl: string,
  options?: {
    taskArguments?: TaskSpecOutput["arguments"];
    authorizationToken?: string;
    runNameOverride?: boolean;
    onSuccess?: (data: PipelineRun) => void;
    onError?: (error: Error) => void;
  },
) {
  const pipelineName = componentSpec.name ?? "Pipeline";

  try {
    const specCopy = structuredClone(componentSpec);
    const componentCache = new Map<string, ComponentSpec>();
    const fullyLoadedSpec = await processComponentSpec(
      specCopy,
      componentCache,
      (_taskId, error) => {
        options?.onError?.(error as Error);
      },
    );
    const argumentsFromInputs = getArgumentsFromInputs(fullyLoadedSpec);
    const normalizedTaskArguments = options?.taskArguments
      ? extractTaskArguments(options.taskArguments)
      : {};
    const payloadArguments = {
      ...argumentsFromInputs,
      ...normalizedTaskArguments,
    };

    const runNameOverride = options?.runNameOverride
      ? processTemplate(getRunNameTemplate(fullyLoadedSpec) ?? "", {
          componentRef: {
            spec: fullyLoadedSpec,
          },
          arguments: payloadArguments,
        }) || undefined
      : undefined;

    const taskAnnotations = runNameOverride
      ? buildAnnotationsWithCanonicalName(pipelineName)
      : undefined;

    const payload: BodyCreateApiPipelineRunsPost = {
      root_task: {
        componentRef: {
          spec: {
            ...fullyLoadedSpec,
            name: runNameOverride ?? pipelineName,
          } as ComponentSpecInput,
        },
        ...(payloadArguments ? { arguments: payloadArguments } : {}),
      },
    };

    if (taskAnnotations) {
      payload.root_task.annotations = taskAnnotations;
    }

    const responseData = await createPipelineRun(
      payload as BodyCreateApiPipelineRunsPost,
      backendUrl,
      options?.authorizationToken,
    );

    if (responseData.id) {
      await savePipelineRun(
        responseData,
        pipelineName,
        componentSpec.metadata?.annotations?.digest as string | undefined,
        runNameOverride,
      );
    }
    options?.onSuccess?.(responseData);
  } catch (e) {
    options?.onError?.(e as Error);
  }
}

const processComponentSpec = async (
  spec: ComponentSpec,
  componentCache: Map<string, ComponentSpec> = new Map(),
  onError?: (taskId: string, error: unknown) => void,
): Promise<ComponentSpec> => {
  if (!spec || !spec.implementation || !("graph" in spec.implementation)) {
    return spec;
  }

  const graph = spec.implementation.graph;
  if (!graph.tasks) {
    return spec;
  }

  for (const [taskId, taskObj] of Object.entries(graph.tasks)) {
    if (
      !taskObj ||
      typeof taskObj !== "object" ||
      !("componentRef" in taskObj)
    ) {
      continue;
    }

    const task = taskObj as { componentRef: ComponentReference };

    if (!task.componentRef) {
      continue;
    }

    // If there's a URL but no spec, fetch the component
    if (task.componentRef.url && !task.componentRef.spec) {
      try {
        if (componentCache.has(task.componentRef.url)) {
          task.componentRef.spec = componentCache.get(task.componentRef.url);
          continue;
        }

        const response = await fetchWithTimeout(task.componentRef.url);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch component: ${response.statusText} (${response.status})`,
          );
        }

        const text = await response.text();
        task.componentRef.text = text;

        try {
          const loadedSpec = parseComponentYaml(text);
          task.componentRef.spec = loadedSpec;

          componentCache.set(task.componentRef.url, loadedSpec);

          if (
            loadedSpec.implementation &&
            "graph" in loadedSpec.implementation
          ) {
            await processComponentSpec(loadedSpec, componentCache, onError);
          }
        } catch (yamlError: unknown) {
          console.error(
            `Error parsing component YAML for ${taskId}:`,
            yamlError,
          );
          const errorMessage =
            yamlError instanceof Error
              ? yamlError.message
              : "Invalid component format";
          throw new Error(`Invalid component format: ${errorMessage}`);
        }
      } catch (error: unknown) {
        console.error(`Error loading component for task ${taskId}:`, error);

        if (onError) {
          onError(taskId, error);
        }

        throw error;
      }
    } else if (task.componentRef.spec) {
      await processComponentSpec(
        task.componentRef.spec,
        componentCache,
        onError,
      );
    }
  }

  return spec;
};

// Load component from text and parse YAML
const parseComponentYaml = (text: string): ComponentSpec => {
  if (!text || text.trim() === "") {
    throw new Error("Received empty component specification");
  }

  return componentSpecFromYaml(text);
};

// Fetch component with timeout to avoid hanging on unresponsive URLs
const fetchWithTimeout = async (url: string, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

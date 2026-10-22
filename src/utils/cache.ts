import * as yaml from "js-yaml";

import type { TaskSpec } from "./componentSpec";
import { ISO8601_DURATION_ZERO_DAYS } from "./constants";
import { PIPELINE_YAML_LOAD_OPTIONS } from "./yaml";

// Data transformer functions

function loadTextFromData(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

export function loadObjectFromYamlData(buffer: ArrayBuffer): object {
  const obj = yaml.load(loadTextFromData(buffer), PIPELINE_YAML_LOAD_OPTIONS);
  if (typeof obj === "object" && obj !== undefined && obj !== null) {
    return obj;
  }
  throw Error(`Expected a YAML-encoded object, but got "${typeof obj}"`);
}

export function isCacheDisabled(taskSpec?: TaskSpec): boolean {
  return (
    taskSpec?.executionOptions?.cachingStrategy?.maxCacheStaleness ===
    ISO8601_DURATION_ZERO_DAYS
  );
}

export function removeCachingStrategyFromSpec(taskSpec: TaskSpec): TaskSpec {
  if (taskSpec.executionOptions?.cachingStrategy) {
    const updatedExecutionOptions = {
      ...taskSpec.executionOptions,
    };
    delete updatedExecutionOptions.cachingStrategy;
    return {
      ...taskSpec,
      executionOptions: updatedExecutionOptions,
    };
  }
  return taskSpec;
}

import yaml from "js-yaml";

import type { TaskSpec } from "./componentSpec";
import { ISO8601_DURATION_ZERO_DAYS } from "./constants";

const httpGetDataWithCache = async <T>(
  url: string,
  transformer: (buffer: ArrayBuffer) => T,
  cacheName: string = "cache",
  updateIfInCache: boolean = false,
): Promise<T> => {
  const cache = await caches.open(cacheName);
  let response = await cache.match(url);
  let needToUpdateCache = false;
  if (response === undefined || updateIfInCache) {
    try {
      const newResponse = await fetch(url);
      if (!newResponse.ok) {
        throw new Error(
          `Network response was not OK: ${newResponse.status}: ${newResponse.statusText}`,
        );
      }
      response = newResponse;
      needToUpdateCache = true;
    } catch (err) {
      if (response === undefined) {
        throw err;
      }
    }
  }
  // Preventing TypeError: Failed to execute 'put' on 'Cache': Response body is already used
  const responseForCaching = response.clone();
  // Need to verify that the transformer executes with error before putting data in cache.
  const result = transformer(await response.arrayBuffer());
  if (needToUpdateCache) {
    await cache.put(url, responseForCaching);
  }
  return result;
};

export type DownloadDataType = <T>(
  url: string,
  transformer: (buffer: ArrayBuffer) => T,
) => Promise<T>;

const IMMUTABLE_URL_REGEXPS = [
  /^https:\/\/raw.githubusercontent.com\/[-A-Za-z_]+\/[-A-Za-z_]+\/[0-9a-fA-f]{40}\/.*/,
  /^https:\/\/gitlab.com\/([-A-Za-z_]+\/){2,}-\/raw\/[0-9a-fA-f]{40}\/.*/,
];

export async function downloadDataWithCache<T>(
  url: string,
  transformer: (buffer: ArrayBuffer) => T,
): Promise<T> {
  const isImmutable = IMMUTABLE_URL_REGEXPS.some((regexp) => url.match(regexp));
  return httpGetDataWithCache(url, transformer, "cache", !isImmutable);
}

// Data transformer functions

function loadTextFromData(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

export function loadObjectFromYamlData(buffer: ArrayBuffer): object {
  const obj = yaml.load(loadTextFromData(buffer));
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

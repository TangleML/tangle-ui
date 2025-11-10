import {
  importPipelineFromYaml,
  type ImportResult,
} from "@/services/pipelineService";
import { isGithubUrl } from "@/utils/URL";

/**
 * Imports a pipeline from a URL by fetching the YAML content and importing it
 * @param url The URL to fetch the pipeline YAML from
 * @returns The result of the import operation
 */
export async function importPipelineFromUrl(
  url: string,
): Promise<ImportResult> {
  if (!isUrlAllowed(url)) {
    throw new Error("Invalid URL or file extension");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch pipeline from URL: ${response.status} ${response.statusText}`,
    );
  }

  const yamlContent = await response.text();

  if (!yamlContent || yamlContent.trim().length === 0) {
    throw new Error("The fetched pipeline content is empty");
  }

  return await importPipelineFromYaml(yamlContent);
}

function isUrlAllowed(url: string) {
  // Allow if it's a github URL or a relative URL (starts with '/'), and ends with .yaml
  return (isGithubUrl(url) || isRelativeUrl(url)) && url.endsWith(".yaml");
}

function isRelativeUrl(url: string) {
  return url.indexOf("://") === -1 && !url.startsWith("//");
}

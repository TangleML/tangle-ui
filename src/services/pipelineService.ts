import * as yaml from "js-yaml";

import { getDefaultRemoteEditorPath } from "@/routes/editorRoutes";
import { createPipelineFromSpec } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { RemotePipelineRef } from "@/services/pipelineStorage/types";
import { isGraphImplementation } from "@/utils/componentSpec";
import { componentSpecFromYaml } from "@/utils/yaml";

export type ImportResult =
  | { successful: true; name: string; remote: RemotePipelineRef; url: string }
  | { successful: false; name: string; errorMessage: string };

export async function importPipelineFromYaml(
  storage: PipelineStorageService,
  yamlContent: string,
): Promise<ImportResult> {
  try {
    const spec = componentSpecFromYaml(yamlContent);
    if (!spec.implementation || !isGraphImplementation(spec.implementation)) {
      throw new Error("This file does not contain a graph pipeline.");
    }
    const name = spec.name || "Imported Pipeline";
    const file = await createPipelineFromSpec(storage, name, { ...spec, name });
    if (!file.remote) throw new Error("The pipeline was not saved.");
    return {
      successful: true,
      name,
      remote: { source: "remote", ...file.remote },
      url: getDefaultRemoteEditorPath(file.id),
    };
  } catch (error) {
    return {
      successful: false,
      name: "",
      errorMessage:
        error instanceof yaml.YAMLException
          ? `YAML syntax error: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Failed to import pipeline.",
    };
  }
}

export async function importPipelineFromFile(
  storage: PipelineStorageService,
  file: File,
): Promise<ImportResult> {
  try {
    return await importPipelineFromYaml(storage, await file.text());
  } catch (error) {
    return {
      successful: false,
      name: "",
      errorMessage:
        error instanceof Error ? error.message : "Failed to read file.",
    };
  }
}

import * as yaml from "js-yaml";

import { getAppSettings } from "@/appSettings";
import {
  getDefaultEditorPath,
  getDefaultRemoteEditorPath,
} from "@/routes/editorRoutes";
import { availablePipelineName } from "@/services/localPipelines/localPipelinesService";
import {
  createPipelineFromContent,
  getPipelineCreationBackendUrl,
} from "@/services/pipelineStorage/pipelineCreation";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { RemotePipelineRef } from "@/services/pipelineStorage/types";
import type { PipelineLibrary } from "@/types/pipelineLibrary";
import { downloadDataWithCache, loadObjectFromYamlData } from "@/utils/cache";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import {
  type ComponentFileEntry,
  deleteComponentFileFromList,
  fullyLoadComponentRefFromUrl,
  getAllComponentFilesFromList,
  getComponentFileFromList,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { componentSpecToYaml } from "@/utils/yaml";
import { componentSpecFromYaml } from "@/utils/yaml";

import {
  deleteEntry,
  findByStorageKey,
} from "./pipelineStorage/pipelineRegistry";

export const deletePipeline = async (name: string, onDelete?: () => void) => {
  try {
    await deleteComponentFileFromList(USER_PIPELINES_LIST_NAME, name);
    const entry = await findByStorageKey(name);
    if (entry) await deleteEntry(entry.id);
    onDelete?.();
  } catch (error) {
    console.error("Error deleting pipeline:", error);
  }
};

export const useSavePipeline = (componentSpec: ComponentSpec) => {
  const storage = usePipelineStorage();
  const savePipeline = async (name?: string) => {
    if (!componentSpec) {
      return;
    }

    const componentSpecWithNewName = {
      ...componentSpec,
      name: name ?? componentSpec.name ?? "Untitled Pipeline",
    };

    const backendUrl = await getPipelineCreationBackendUrl();
    const existingLocal =
      (!backendUrl || name === undefined) &&
      (await getComponentFileFromList(
        USER_PIPELINES_LIST_NAME,
        componentSpecWithNewName.name,
      ));
    if (existingLocal) {
      const file = await storage.resolvePipeline({
        name: componentSpecWithNewName.name,
      });
      await file.write(componentSpecToYaml(componentSpecWithNewName));
      return { url: getDefaultEditorPath(componentSpecWithNewName.name) };
    }

    if (!backendUrl) {
      componentSpecWithNewName.name = await availablePipelineName(
        componentSpecWithNewName.name,
      );
    }
    const file = await createPipelineFromContent(
      storage,
      componentSpecWithNewName.name,
      componentSpecToYaml(componentSpecWithNewName),
      { backendUrl },
    );
    return file.remote
      ? {
          url: getDefaultRemoteEditorPath(file.id),
          remote: true as const,
        }
      : { url: getDefaultEditorPath(file.storageKey) };
  };

  return {
    savePipeline,
  };
};

export const loadPipelineByName = async (name: string) => {
  const decodedName = decodeURIComponent(name);
  const appSettings = getAppSettings();

  try {
    // Fetch user pipelines
    let userPipelines: Map<string, ComponentFileEntry>;
    try {
      userPipelines = await getAllComponentFilesFromList(
        USER_PIPELINES_LIST_NAME,
      );
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
      return {
        experiment: null,
        isLoading: false,
        error: "Failed to load user pipelines",
      };
    }

    // Check if pipeline exists in user pipelines
    const pipeline = userPipelines.get(decodedName);
    if (pipeline) {
      return {
        experiment: pipeline,
        isLoading: false,
        error: null,
      };
    }

    try {
      const pipelineLibrary = await downloadDataWithCache(
        appSettings.pipelineLibraryUrl,
        (data) => loadObjectFromYamlData(data) as PipelineLibrary,
      );

      if (pipelineLibrary?.components) {
        const pipelineLibraryEntry = pipelineLibrary.components.find(
          (entry) => entry.name.toLowerCase() === decodedName.toLowerCase(),
        );

        if (pipelineLibraryEntry) {
          const loadedComponentRef = await fullyLoadComponentRefFromUrl(
            pipelineLibraryEntry.url,
            downloadDataWithCache,
          );

          return {
            experiment: {
              componentRef: loadedComponentRef,
              spec: loadedComponentRef.spec,
            },
            isLoading: false,
            error: null,
          };
        }
      }
    } catch (error) {
      console.error("Failed to load pipeline library:", error);
      // Continue execution - we'll return "Pipeline not found" if it wasn't in user pipelines
    }

    // If we get here, the pipeline wasn't found
    return {
      experiment: null,
      isLoading: false,
      error: "Pipeline not found",
    };
  } catch (error) {
    console.error("Error loading pipeline:", error);
    return {
      experiment: null,
      isLoading: false,
      error: "Error loading pipeline",
    };
  }
};

export interface ImportResult {
  name: string;
  overwritten: boolean;
  successful: boolean;
  errorMessage?: string;
  remote?: RemotePipelineRef;
  url?: string;
}

/**
 * Imports a pipeline from YAML content and saves it to the user's pipeline library
 * @param yamlContent The YAML content to import as a string
 * @param overwrite Optional. Whether to overwrite if a pipeline with the same name exists
 * @returns The result of the import, with the pipeline name and unique flag
 */
export async function importPipelineFromYaml(
  storage: PipelineStorageService,
  yamlContent: string,
  overwrite = false,
): Promise<ImportResult> {
  try {
    // Parse the YAML content to get the component spec
    const componentSpec = componentSpecFromYaml(yamlContent);

    // Validate the component spec has the required structure
    if (
      !componentSpec.implementation ||
      !isGraphImplementation(componentSpec.implementation)
    ) {
      const errorMessage =
        "Invalid pipeline structure. This doesn't appear to be a graph-based pipeline.";
      console.error(errorMessage);
      return {
        name: "",
        overwritten: false,
        successful: false,
        errorMessage,
      };
    }

    // Use the name from the YAML or default to "Imported Pipeline"
    let pipelineName = componentSpec.name || "Imported Pipeline";
    let wasRenamed = false;

    const backendUrl = await getPipelineCreationBackendUrl();
    if (backendUrl) {
      const file = await createPipelineFromContent(
        storage,
        pipelineName,
        componentSpecToYaml({ ...componentSpec, name: pipelineName }),
        { backendUrl },
      );
      return {
        name: pipelineName,
        overwritten: false,
        successful: true,
        remote: file.remote && { source: "remote", ...file.remote },
        url: getDefaultRemoteEditorPath(file.id),
      };
    }

    // Check if a pipeline with this name already exists
    const existingPipeline = await getComponentFileFromList(
      USER_PIPELINES_LIST_NAME,
      pipelineName,
    );

    if (!existingPipeline || !overwrite) {
      const originalName = pipelineName;
      pipelineName = await availablePipelineName(pipelineName);
      wasRenamed = pipelineName !== originalName;
      if (wasRenamed) componentSpec.name = pipelineName;
    }

    // Standardize the YAML to ensure consistent format
    // This also ensures the ComponentSpec is valid
    const standardizedYaml = componentSpecToYaml(componentSpec);

    if (existingPipeline && overwrite) {
      const file = await storage.resolvePipeline({ name: pipelineName });
      await file.write(standardizedYaml);
    } else {
      await createPipelineFromContent(storage, pipelineName, standardizedYaml, {
        backendUrl,
      });
    }

    return {
      name: pipelineName,
      overwritten: Boolean(existingPipeline && overwrite),
      successful: true,
      errorMessage: wasRenamed
        ? `Pipeline was renamed to "${pipelineName}" to avoid name conflict.`
        : undefined,
    };
  } catch (error) {
    let errorMessage = "Failed to import pipeline.";

    // Provide more specific error messages for different error types
    if (error instanceof yaml.YAMLException) {
      errorMessage = `YAML syntax error: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error("Failed to import pipeline:", error);
    return {
      name: "",
      overwritten: false,
      successful: false,
      errorMessage,
    };
  }
}

/**
 * Imports a pipeline from a File object (from a file input)
 * @param file The file object from the file input
 * @param overwrite Optional. Whether to overwrite existing pipeline
 * @returns The result of the import operation
 */
export async function importPipelineFromFile(
  storage: PipelineStorageService,
  file: File,
  overwrite = false,
): Promise<ImportResult> {
  try {
    const yamlContent = await file.text();
    return importPipelineFromYaml(storage, yamlContent, overwrite);
  } catch (error) {
    let errorMessage = "Failed to read file.";
    if (error instanceof Error) {
      errorMessage = `File error: ${error.message}`;
    }

    console.error("Failed to read file:", error);
    return {
      name: "",
      overwritten: false,
      successful: false,
      errorMessage,
    };
  }
}

export function getPipelineFile(pipelineName: string) {
  return getComponentFileFromList(USER_PIPELINES_LIST_NAME, pipelineName);
}

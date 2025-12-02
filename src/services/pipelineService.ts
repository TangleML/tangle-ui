import yaml from "js-yaml";

import { getAppSettings } from "@/appSettings";
import type { PipelineLibrary } from "@/types/pipelineLibrary";
import { downloadDataWithCache, loadObjectFromYamlData } from "@/utils/cache";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import {
  type ComponentFileEntry,
  componentSpecToYaml,
  deleteComponentFileFromList,
  fullyLoadComponentRefFromUrl,
  getAllComponentFilesFromList,
  getComponentFileFromList,
  writeComponentToFileListFromText,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { componentSpecFromYaml } from "@/utils/yaml";

export const deletePipeline = async (name: string, onDelete?: () => void) => {
  try {
    await deleteComponentFileFromList(USER_PIPELINES_LIST_NAME, name);
    onDelete?.();
  } catch (error) {
    console.error("Error deleting pipeline:", error);
  }
};

export const useSavePipeline = (componentSpec: ComponentSpec) => {
  const savePipeline = async (name?: string) => {
    if (!componentSpec) {
      return;
    }

    const componentSpecWithNewName = {
      ...componentSpec,
      name: name ?? componentSpec.name ?? "Untitled Pipeline",
    };

    const componentSpecAsYaml = componentSpecToYaml(componentSpecWithNewName);

    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      componentSpecWithNewName.name,
      componentSpecAsYaml,
    );
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
}

/**
 * Generates a unique pipeline name by adding a numbered suffix when a collision occurs
 * @param baseName The original pipeline name
 * @returns A promise resolving to a unique pipeline name
 */
async function generateUniquePipelineName(baseName: string): Promise<string> {
  // First check if the base name is available
  const existingPipeline = await getComponentFileFromList(
    USER_PIPELINES_LIST_NAME,
    baseName,
  );

  if (!existingPipeline) {
    return baseName; // Base name is available
  }

  // Base name exists, try adding numbers
  let counter = 1;
  let newName = `${baseName} (${counter})`;

  // Keep checking until we find an available name
  while (await getComponentFileFromList(USER_PIPELINES_LIST_NAME, newName)) {
    counter++;
    newName = `${baseName} (${counter})`;
  }

  return newName;
}

/**
 * Imports a pipeline from YAML content and saves it to the user's pipeline library
 * @param yamlContent The YAML content to import as a string
 * @param overwrite Optional. Whether to overwrite if a pipeline with the same name exists
 * @returns The result of the import, with the pipeline name and unique flag
 */
export async function importPipelineFromYaml(
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

    // Check if a pipeline with this name already exists
    const existingPipeline = await getComponentFileFromList(
      USER_PIPELINES_LIST_NAME,
      pipelineName,
    );

    // If exists and we're not overwriting, generate a unique name
    if (existingPipeline && !overwrite) {
      const originalName = pipelineName;
      pipelineName = await generateUniquePipelineName(pipelineName);
      wasRenamed = pipelineName !== originalName;

      // Update the component spec name to match the new name
      componentSpec.name = pipelineName;
    }

    // Standardize the YAML to ensure consistent format
    // This also ensures the ComponentSpec is valid
    const standardizedYaml = componentSpecToYaml(componentSpec);

    // Save the pipeline to IndexedDB
    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      pipelineName,
      standardizedYaml,
    );

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
  file: File,
  overwrite = false,
): Promise<ImportResult> {
  try {
    const yamlContent = await file.text();
    return importPipelineFromYaml(yamlContent, overwrite);
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

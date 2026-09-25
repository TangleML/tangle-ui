import yaml from "js-yaml";

import { getAppSettings } from "@/appSettings";
import type { PipelineLibrary } from "@/types/pipelineLibrary";
import { downloadDataWithCache, loadObjectFromYamlData } from "@/utils/cache";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import {
  fullyLoadComponentRefFromUrl,
  loadComponentAsRefFromText,
} from "@/utils/componentStore";
import { componentSpecToYaml } from "@/utils/yaml";
import { componentSpecFromYaml } from "@/utils/yaml";

import type { PipelineFile } from "./pipelineStorage/PipelineFile";
import {
  findPipelineFile,
  listPipelineFiles,
  savePipeline as savePipelineToStore,
} from "./pipelineStorage/pipelineOperations";
import { usePipelineStorage } from "./pipelineStorage/PipelineStorageProvider";

export const useSavePipeline = (componentSpec: ComponentSpec) => {
  const storage = usePipelineStorage();

  const savePipeline = async (name?: string) => {
    if (!componentSpec) {
      return undefined;
    }

    const componentSpecWithNewName = {
      ...componentSpec,
      name: name ?? componentSpec.name ?? "Untitled Pipeline",
    };

    return storage.savePipelineByName(
      componentSpecWithNewName.name,
      componentSpecToYaml(componentSpecWithNewName),
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
    /**
     * A store that cannot answer is reported as such. Falling through to the
     * example library would quietly serve a different pipeline that happens to
     * share the name, and the editor would then save over the user's own.
     */
    let file: PipelineFile | undefined;
    try {
      file = await findPipelineFile({ name: decodedName });
    } catch (error) {
      console.error("Failed to load user pipelines:", error);
      return {
        experiment: null,
        isLoading: false,
        error: "Failed to load user pipelines",
      };
    }

    if (file) {
      const componentRef = await loadComponentAsRefFromText(await file.read());
      return {
        experiment: { componentRef, spec: componentRef.spec },
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
  fileId?: string;
  overwritten: boolean;
  successful: boolean;
  errorMessage?: string;
}

function generateUniquePipelineName(
  baseName: string,
  taken: ReadonlySet<string>,
): string {
  if (!taken.has(baseName)) {
    return baseName;
  }

  let counter = 1;
  while (taken.has(`${baseName} (${counter})`)) {
    counter++;
  }

  return `${baseName} (${counter})`;
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

    const taken = new Set(
      (await listPipelineFiles()).map((file) => file.displayName),
    );
    const nameExists = taken.has(pipelineName);

    // If exists and we're not overwriting, generate a unique name
    if (nameExists && !overwrite) {
      const originalName = pipelineName;
      pipelineName = generateUniquePipelineName(pipelineName, taken);
      wasRenamed = pipelineName !== originalName;

      // Update the component spec name to match the new name
      componentSpec.name = pipelineName;
    }

    // Standardize the YAML to ensure consistent format
    // This also ensures the ComponentSpec is valid
    const standardizedYaml = componentSpecToYaml(componentSpec);

    const file = await savePipelineToStore(pipelineName, standardizedYaml);

    return {
      name: file.displayName,
      fileId: file.id,
      overwritten: nameExists && overwrite,
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

import { hydrateComponentReference } from "@/services/componentService";
import {
  type ComponentFolder,
  isValidComponentLibrary,
} from "@/types/componentLibrary";
import { loadObjectFromYamlData } from "@/utils/cache";
import {
  type ComponentReference,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";

import { isValidFilterRequest, type LibraryFilterRequest } from "../types";
import {
  InvalidComponentReferenceError,
  type Library,
  ReadOnlyLibraryError,
} from "./types";
import { fetchWithCache } from "./utils";

class YamlFileLibraryError extends Error {
  name = "YamlFileLibraryError";

  constructor(message: string) {
    super(message);
  }
}

export class YamlFileLibrary implements Library {
  #components: Map<string, ComponentReference> = new Map();
  #rootFolder: ComponentFolder;
  #loading: Promise<void>;

  constructor(
    name: string,
    private readonly yamlFilePath: string,
  ) {
    this.#rootFolder = {
      name,
      folders: [],
      components: [],
    };

    this.#loading = this.#loadLibrary();
  }

  async hasComponent(component: ComponentReference): Promise<boolean> {
    await this.#loading;

    if (!isDiscoverableComponentReference(component)) {
      throw new InvalidComponentReferenceError(component);
    }

    return this.#components.has(component.digest);
  }

  async addComponent(): Promise<void> {
    throw new ReadOnlyLibraryError("This library is read-only");
  }

  async removeComponent(): Promise<void> {
    throw new ReadOnlyLibraryError("This library is read-only");
  }

  async getComponents(filter?: LibraryFilterRequest): Promise<ComponentFolder> {
    await this.#loading;

    if (isValidFilterRequest(filter)) {
      return {
        name: this.#rootFolder.name,
        // TODO: implement contentful filter
        components: Array.from(this.#components.values()),
      };
    }

    return {
      name: this.#rootFolder.name,
      components: this.#rootFolder.components ?? [],
      folders: this.#rootFolder.folders ?? [],
    };
  }

  async #loadLibrary() {
    const response = await fetchWithCache(this.yamlFilePath);

    if (!response.ok) {
      throw new YamlFileLibraryError(
        `Failed to fetch ${this.yamlFilePath}: ${response.status}`,
      );
    }

    const data = await response.arrayBuffer();

    const yamlData = loadObjectFromYamlData(data);

    if (!isValidComponentLibrary(yamlData)) {
      throw new YamlFileLibraryError(
        `Invalid component library: ${this.yamlFilePath}`,
      );
    }

    // visit all components and folders in the library
    const queue = [
      ...yamlData.folders.map((folder) => ({
        folder,
        parent: this.#rootFolder,
      })),
    ];

    // BFS to process folders and components
    while (queue.length > 0) {
      const queuedFolder = queue.shift();
      if (!queuedFolder) {
        continue;
      }

      const { folder, parent } = queuedFolder;

      const currentFolder: ComponentFolder = {
        name: folder.name,
        components: [],
        folders: [],
      };

      for (const componentRef of folder.components ?? []) {
        // todo: we can skip hydration if the component has at least digest, url and name
        const hydratedComponentRef =
          await hydrateComponentReference(componentRef);

        if (!hydratedComponentRef) {
          // todo: track component failure
          console.warn(
            `Failed to hydrate component: ${componentRef.url ?? componentRef.digest}`,
            componentRef,
          );
          continue;
        }

        this.#components.set(hydratedComponentRef.digest, hydratedComponentRef);
        currentFolder.components = [
          ...(folder.components ?? []),
          hydratedComponentRef,
        ];
      }

      parent.folders = [...(parent.folders ?? []), currentFolder];

      queue.push(
        ...(folder.folders?.map((subfolder) => ({
          folder: subfolder,
          parent: currentFolder,
        })) ?? []),
      );
    }

    console.log("Loaded library", this.#rootFolder);
  }
}

import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentFolder } from "@/types/componentLibrary";
import {
  type ComponentReference,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";

import { isValidFilterRequest, type LibraryFilterRequest } from "../types";
import { LibraryDB, type StoredLibrary } from "./storage";
import {
  DuplicateComponentError,
  InvalidComponentReferenceError,
  type Library,
} from "./types";
import { dispatchLibraryChangeEvent } from "./utils";

class LibraryNotFoundError extends Error {
  name = "LibraryNotFoundError";
  constructor(message: string) {
    super(message);
  }
}

export class BrowserPersistedLibrary implements Library {
  #loading: Promise<void>;
  #components = new Map<string, ComponentReference>();
  #eventEmitter: EventTarget = new EventTarget();

  constructor(
    private readonly libId: string,
    private readonly createLibrary: () => Promise<StoredLibrary | undefined>,
  ) {
    this.#loading = this.#loadLibrary();
  }

  get eventEmitter() {
    return this.#eventEmitter;
  }

  async #loadLibrary() {
    const library =
      (await LibraryDB.component_libraries.get(this.libId)) ??
      (await this.createLibrary());

    if (!library) {
      throw new LibraryNotFoundError(`Library ${this.libId} not found`);
    }

    const components = library.components ?? [];

    const hydratedComponents = (
      await Promise.all(
        components.map(async (component) => {
          return await hydrateComponentReference(component);
        }),
        // todo: handle per-component errors
      )
    ).filter((c) => isDiscoverableComponentReference(c));

    hydratedComponents.forEach((component) => {
      this.#components.set(component.digest, component);
    });
  }

  async hasComponent(component: ComponentReference): Promise<boolean> {
    await this.#loading;

    if (!isDiscoverableComponentReference(component)) {
      return false;
    }

    return this.#components.has(component.digest);
  }

  async addComponent(component: ComponentReference): Promise<void> {
    await this.#loading;

    const hydratedComponent = await hydrateComponentReference(component);

    if (!hydratedComponent) {
      throw new InvalidComponentReferenceError(component);
    }

    if (this.#components.has(hydratedComponent.digest)) {
      throw new DuplicateComponentError(component);
    }

    await LibraryDB.component_libraries
      .where("id")
      .equals(this.libId)
      .modify((lib) => {
        lib.knownDigests = Array.from(
          new Set([...(lib.knownDigests ?? []), hydratedComponent.digest]),
        );
        lib.components = [...(lib.components ?? []), hydratedComponent];
      });

    this.#components.set(hydratedComponent.digest, hydratedComponent);

    dispatchLibraryChangeEvent(this, "add", hydratedComponent);
  }

  async removeComponent(component: ComponentReference): Promise<void> {
    await this.#loading;

    if (!isDiscoverableComponentReference(component)) {
      throw new InvalidComponentReferenceError(component);
    }

    // todo: handle options like what library/storage
    await LibraryDB.component_libraries
      .where("id")
      .equals(this.libId)
      .modify((lib) => {
        lib.components = lib.components?.filter(
          (c) => c.digest !== component.digest,
        );
        lib.knownDigests = lib.knownDigests?.filter(
          (digest) => digest !== component.digest,
        );
      });

    this.#components.delete(component.digest);

    dispatchLibraryChangeEvent(this, "remove", component);
  }

  async getComponents(filter?: LibraryFilterRequest): Promise<ComponentFolder> {
    await this.#loading;

    if (isValidFilterRequest(filter)) {
      // todo: filter components
    }

    const library = await LibraryDB.component_libraries.get(this.libId);

    return {
      name: library?.name ?? this.libId,
      components: Array.from(this.#components.values()),
      // todo: support folders
      folders: [],
    };
  }
}

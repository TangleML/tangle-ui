import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentFolder } from "@/types/componentLibrary";
import {
  type ComponentReference,
  type GraphSpec,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";

import { isValidFilterRequest, type LibraryFilterRequest } from "../types";
import { type Library, ReadOnlyLibraryError } from "./types";
import { dispatchLibraryChangeEvent } from "./utils";

export class GraphSpecReadonlyLibrary implements Library {
  #graphSpec: GraphSpec | undefined;
  #components: Map<string, ComponentReference> = new Map();
  #eventEmitter: EventTarget = new EventTarget();

  constructor(
    private readonly name: string,
    graphSpec: GraphSpec | undefined,
  ) {
    void this.setGraphSpec(graphSpec);
  }

  get eventEmitter() {
    return this.#eventEmitter;
  }

  async setGraphSpec(graphSpec: GraphSpec | undefined) {
    this.#graphSpec = graphSpec;
    void this.#refresh();
  }

  async getComponents(filter?: LibraryFilterRequest): Promise<ComponentFolder> {
    if (isValidFilterRequest(filter)) {
      const components = Array.from(this.#components.values()).filter(
        (component) => {
          // todo: search by some other fields from
          return component.name
            ?.toLowerCase()
            .includes(filter.searchTerm.toLowerCase());
        },
      );

      return {
        name: this.name,
        components,
        folders: [],
      };
    }

    return {
      name: this.name,
      components: Array.from(this.#components.values()),
      folders: [],
    };
  }

  async hasComponent(component: ComponentReference): Promise<boolean> {
    await this.#refresh();

    if (!isDiscoverableComponentReference(component)) {
      return false;
    }

    return this.#components.has(component.digest);
  }

  async addComponent(): Promise<void> {
    throw new ReadOnlyLibraryError("This library is read-only.");
  }

  async removeComponent(): Promise<void> {
    throw new ReadOnlyLibraryError("This library is read-only.");
  }

  async #refresh() {
    this.#components.clear();

    if (!this.#graphSpec) {
      dispatchLibraryChangeEvent(this, "refresh");
      return;
    }

    if (
      !this.#graphSpec ||
      !this.#graphSpec.tasks ||
      typeof this.#graphSpec.tasks !== "object"
    ) {
      dispatchLibraryChangeEvent(this, "refresh");
      return;
    }

    for (const task of Object.values(this.#graphSpec.tasks)) {
      const key = task.componentRef.digest;
      if (key) {
        const hydratedComponent = await hydrateComponentReference(
          task.componentRef,
        );

        if (!hydratedComponent) {
          // todo: how to handle individual components that are failed to load?
          return;
        }

        this.#components.set(key, hydratedComponent);
      }
    }

    dispatchLibraryChangeEvent(this, "refresh");
  }
}

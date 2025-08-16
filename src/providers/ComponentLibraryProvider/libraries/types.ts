import type { ComponentFolder } from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";

import type { LibraryFilterRequest } from "../types";

interface AddComponentOptions {
  path?: string[];
}

export interface RemoveComponentOptions {
  supersedeBy?: ComponentReference;
}

export interface Library {
  hasComponent(component: ComponentReference): Promise<boolean>;
  addComponent(
    component: ComponentReference,
    options?: AddComponentOptions,
  ): Promise<void>;
  removeComponent(
    component: ComponentReference,
    options?: RemoveComponentOptions,
  ): Promise<void>;

  getComponents(filter?: LibraryFilterRequest): Promise<ComponentFolder>;

  eventEmitter?: EventTarget;
}

export class InvalidComponentReferenceError extends Error {
  name = "InvalidComponentReferenceError";

  constructor(component: ComponentReference) {
    super(
      `Invalid component reference: ${component.digest ?? component.url ?? ""}`,
    );
  }
}

export class DuplicateComponentError extends Error {
  name = "DuplicateComponentError";

  constructor(component: ComponentReference) {
    super(
      `Component already exists in library: ${component.digest ?? component.url ?? ""}`,
    );
  }
}

export class ReadOnlyLibraryError extends Error {
  name = "ReadOnlyLibraryError";

  constructor(message: string) {
    super(message);
  }
}

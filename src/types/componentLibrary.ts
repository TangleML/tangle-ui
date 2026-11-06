import type { ReactElement } from "react";

import type { ComponentReference } from "@/utils/componentSpec";

export type ComponentLibrary = {
  annotations?: {
    [k: string]: unknown;
  };
  folders: ComponentFolder[];
};

export type ComponentFolder = {
  name: string;
  components?: ComponentReference[];
  folders?: ComponentFolder[];
  isUserFolder?: boolean;
};

// Special type for UI components that can include React elements
export type UIComponentFolder = {
  name: string;
  components?: (ComponentReference | ReactElement)[];
  folders?: UIComponentFolder[];
  isUserFolder?: boolean;
};

export type SearchResult = {
  components: {
    standard: ComponentReference[];
    user: ComponentReference[];
    used: ComponentReference[];
  };
};

export const isValidComponentLibrary = (obj: object): obj is ComponentLibrary =>
  "folders" in obj;

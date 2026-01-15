import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";

export interface TaskSpecShape {
  componentRef: Omit<ComponentReference, "spec"> & {
    spec: ComponentSpec;
  };
  arguments?: Record<string, string> | null;
  annotations?: Record<string, unknown> | null;
}

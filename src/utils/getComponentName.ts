import type {
  ComponentReference,
  ComponentSpec,
  TaskSpec,
} from "./componentSpec";
import { removeTrailingDateFromTitle } from "./string";

export const getComponentName = (component: ComponentReference): string => {
  return (
    component.spec?.name ||
    component.url?.split("/").pop()?.replace(".yaml", "") ||
    "Component"
  );
};

export function getInitialName(
  componentSpec: ComponentSpec,
  canonicalName?: string,
): string {
  const dateTime = new Date().toISOString();
  const baseName = canonicalName ?? componentSpec.name ?? "Pipeline";

  return `${removeTrailingDateFromTitle(baseName)} (${dateTime})`;
}

export function getTaskDisplayName(
  taskId: string,
  taskSpec?: TaskSpec,
): string {
  return (
    (taskSpec?.annotations?.["display_name"] as string) ||
    taskSpec?.componentRef?.spec?.name ||
    taskId
  );
}

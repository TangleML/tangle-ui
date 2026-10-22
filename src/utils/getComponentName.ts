import type { ComponentReference, ComponentSpec } from "./componentSpec";
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

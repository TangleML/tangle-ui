import { extractCanonicalName } from "./canonicalPipelineName";
import type { ComponentReference, ComponentSpec } from "./componentSpec";
import { removeTrailingDateFromTitle } from "./string";

export const getComponentName = (component: ComponentReference): string => {
  return (
    component.spec?.name ||
    component.url?.split("/").pop()?.replace(".yaml", "") ||
    "Component"
  );
};

export function getInitialName(componentSpec: ComponentSpec): string {
  const dateTime = new Date().toISOString();
  const baseName =
    extractCanonicalName(componentSpec) ?? componentSpec.name ?? "Pipeline";

  return `${removeTrailingDateFromTitle(baseName)} (${dateTime})`;
}

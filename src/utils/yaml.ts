import yaml from "js-yaml";

import { type ComponentSpec, isValidComponentSpec } from "./componentSpec";

class ComponentSpecParsingError extends Error {
  readonly name = "ComponentSpecParsingError";

  constructor(
    message: string,
    public readonly extra: {
      yamlText?: string;
      loadedSpec?: any;
    } = {},
  ) {
    super(message);
  }
}

export function componentSpecFromYaml(yamlText: string): ComponentSpec {
  const loadedSpec = yaml.load(yamlText);
  if (typeof loadedSpec !== "object" || loadedSpec === null) {
    throw new ComponentSpecParsingError(
      "Invalid component specification format",
      { yamlText },
    );
  }

  // todo: consider advanced validation
  if (!isValidComponentSpec(loadedSpec)) {
    throw new ComponentSpecParsingError(
      "Invalid component specification format",
      { loadedSpec },
    );
  }

  return loadedSpec;
}

export const componentSpecToYaml = (componentSpec: ComponentSpec) => {
  return yaml.dump(componentSpec, { lineWidth: -1 });
};

export const componentSpecToText = (componentSpec: ComponentSpec) => {
  return yaml.dump(componentSpec, {
    lineWidth: -1,
    noRefs: true,
    indent: 2,
  });
};

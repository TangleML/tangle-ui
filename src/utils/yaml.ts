import yaml from "js-yaml";

import { type ComponentSpec, isValidComponentSpec } from "./componentSpec";

// Each subgraph level nests ~6 YAML mappings. A limit of 1000 allows around 150 levels of nested subgraphs.
export const PIPELINE_YAML_LOAD_OPTIONS = {
  maxDepth: 1000,
} as unknown as yaml.LoadOptions;

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
  const loadedSpec = yaml.load(yamlText, PIPELINE_YAML_LOAD_OPTIONS);
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

import yaml from "js-yaml";

import { type ComponentSpec, isValidComponentSpec } from "./componentSpec";
import { componentSpecToText } from "./componentStore";

const copyToYaml = (
  spec: ComponentSpec,
  onSuccess: (message: string) => void,
  onFail: (message: string) => void,
) => {
  const code = componentSpecToText(spec);

  navigator.clipboard.writeText(code).then(
    () => onSuccess("YAML copied to clipboard"),
    (err) => onFail("Failed to copy YAML: " + err),
  );
};

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

export default copyToYaml;

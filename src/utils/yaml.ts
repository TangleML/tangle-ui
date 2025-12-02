import type { ComponentSpec } from "./componentSpec";
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

export default copyToYaml;

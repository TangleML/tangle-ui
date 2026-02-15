import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";

/**
 * A simple container component for use as task componentRef
 */
const simpleContainerComponent: ComponentSpec = {
  name: "Simple Container",
  description: "A simple container component",
  inputs: [{ name: "input_data", type: "String", description: "Input data" }],
  outputs: [
    { name: "output_data", type: "String", description: "Output data" },
  ],
  implementation: {
    container: {
      image: "alpine:latest",
      command: ["echo"],
      args: [{ inputValue: "input_data" }],
    },
  },
};

export const simpleContainerComponentRef: ComponentReference = {
  name: "Simple Container",
  digest: "sha256:abc123",
  spec: simpleContainerComponent,
  text: "name: Simple Container\nimplementation:\n  container:\n    image: alpine:latest",
};

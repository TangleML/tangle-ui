import type {
  ComponentReference,
  ComponentSpec,
  GraphImplementation,
} from "@/utils/componentSpec";

/**
 * A simple container component for use as task componentRef
 */
export const simpleContainerComponent: ComponentSpec = {
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

/**
 * Expected output for a simple pipeline with one task using literal arguments
 */
export const expectedSimplePipeline: ComponentSpec = {
  name: "Simple Pipeline",
  description: "A simple pipeline with one task",
  inputs: [],
  outputs: [],
  implementation: {
    graph: {
      tasks: {
        task1: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: "hello world",
          },
        },
      },
    },
  } as GraphImplementation,
};

/**
 * Expected output for a pipeline with graph input arguments
 */
export const expectedPipelineWithGraphInputs: ComponentSpec = {
  name: "Pipeline with Graph Inputs",
  description: "Pipeline that passes graph inputs to tasks",
  inputs: [
    { name: "pipeline_input", type: "String", description: "Pipeline input" },
  ],
  outputs: [],
  implementation: {
    graph: {
      tasks: {
        process_task: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: {
              graphInput: {
                inputName: "pipeline_input",
              },
            },
          },
        },
      },
    },
  } as GraphImplementation,
};

/**
 * Expected output for a pipeline with task output arguments
 */
export const expectedPipelineWithTaskOutputs: ComponentSpec = {
  name: "Pipeline with Task Outputs",
  description: "Pipeline with chained tasks",
  inputs: [],
  outputs: [],
  implementation: {
    graph: {
      tasks: {
        first_task: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: "initial data",
          },
        },
        second_task: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: {
              taskOutput: {
                taskId: "first_task",
                outputName: "output_data",
              },
            },
          },
        },
      },
    },
  } as GraphImplementation,
};

/**
 * Expected output for a pipeline with outputValues
 */
export const expectedPipelineWithOutputValues: ComponentSpec = {
  name: "Pipeline with Output Values",
  description: "Pipeline that exposes task outputs as graph outputs",
  inputs: [],
  outputs: [
    {
      name: "pipeline_output",
      type: "String",
      description: "Pipeline output",
    },
  ],
  implementation: {
    graph: {
      tasks: {
        process_task: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: "data",
          },
        },
      },
      outputValues: {
        pipeline_output: {
          taskOutput: {
            taskId: "process_task",
            outputName: "output_data",
          },
        },
      },
    },
  } as GraphImplementation,
};

/**
 * Expected output for a pipeline with metadata and annotations
 */
export const expectedPipelineWithMetadataAndAnnotations: ComponentSpec = {
  name: "Pipeline with Metadata",
  description: "Pipeline demonstrating metadata and annotations",
  metadata: {
    annotations: {
      author: "test-author",
      version: "1.0.0",
    },
  },
  inputs: [
    {
      name: "annotated_input",
      type: "String",
      description: "An input with annotations",
      annotations: {
        ui_hint: "text_area",
        required_level: "high",
      },
    },
  ],
  outputs: [
    {
      name: "annotated_output",
      type: "String",
      description: "An output with annotations",
      annotations: {
        format: "json",
      },
    },
  ],
  implementation: {
    graph: {
      tasks: {
        task_with_annotations: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: {
              graphInput: {
                inputName: "annotated_input",
              },
            },
          },
          annotations: {
            task_priority: "high",
          },
        },
      },
    },
  } as GraphImplementation,
};

/**
 * Expected output for a full pipeline with execution options
 */
export const expectedFullPipeline: ComponentSpec = {
  name: "Full Pipeline",
  description: "A comprehensive pipeline with all features",
  metadata: {
    annotations: {
      canonical_location: "https://example.com/pipelines/full",
      author: "test-author",
    },
  },
  inputs: [
    {
      name: "required_input",
      type: "String",
      description: "A required input",
    },
    {
      name: "optional_input",
      type: "Integer",
      description: "An optional input",
      optional: true,
      default: "42",
    },
  ],
  outputs: [
    {
      name: "final_output",
      type: "String",
      description: "The final output",
    },
  ],
  implementation: {
    graph: {
      tasks: {
        first_task: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: {
              graphInput: {
                inputName: "required_input",
              },
            },
          },
          executionOptions: {
            cachingStrategy: {
              maxCacheStaleness: "P1D",
            },
          },
        },
        second_task: {
          componentRef: {
            name: "Simple Container",
            digest: "sha256:abc123",
          },
          arguments: {
            input_data: {
              taskOutput: {
                taskId: "first_task",
                outputName: "output_data",
              },
            },
          },
          executionOptions: {
            retryStrategy: {
              maxRetries: 3,
            },
          },
        },
      },
      outputValues: {
        final_output: {
          taskOutput: {
            taskId: "second_task",
            outputName: "output_data",
          },
        },
      },
    },
  } as GraphImplementation,
};


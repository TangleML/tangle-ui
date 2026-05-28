---
name: Component YAML Format
description: Reference for the Tangle component YAML specification format
---

# Tangle Component YAML Format

## Basic Structure

```yaml
name: Component Name
description: What this component does
metadata:
  annotations:
    cloud_pipelines.net: "true"

inputs:
  - name: input_data
    type: String
    description: Description of input
  - name: config
    type: String
    default: "default_value"
    optional: true

outputs:
  - name: output_data
    type: String
    description: Description of output

implementation:
  container:
    image: python:3.10
    command:
      - sh
      - -c
      - |
        python3 -c "
        # inline Python code
        "
    args:
      - --input
      - { inputPath: input_data }
      - --output
      - { outputPath: output_data }
      - --config
      - { inputValue: config }
```

## Types

Common input/output types:

- `String` — text data or file paths
- `Integer` — whole numbers
- `Float` — decimal numbers
- `Boolean` — true/false
- `JsonObject` — structured JSON data
- `JsonArray` — JSON arrays
- `URI` — file URIs or URLs
- `ApacheParquet` — Parquet files (artifact type)
- `CSV` — CSV files (artifact type)

## Graph Implementation (Pipelines)

Pipelines use `implementation.graph` instead of `implementation.container`:

```yaml
name: My Pipeline
implementation:
  graph:
    tasks:
      task-name:
        componentRef:
          name: Component Name
          spec: { ... }
        arguments:
          input_name: "{{inputs.pipeline_input}}"
          other_input:
            taskOutput:
              taskId: other-task
              outputName: output_name
    outputValues:
      pipeline_output:
        taskOutput:
          taskId: final-task
          outputName: result
```

## Argument References

- `{{inputs.name}}` — reference a pipeline-level input
- `{{tasks.taskName.outputs.outputName}}` — reference a task output
- `{graphInput: {inputName: name}}` — object form of input reference
- `{taskOutput: {taskId: name, outputName: name}}` — object form of task output reference

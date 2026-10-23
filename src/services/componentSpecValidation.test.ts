import { unregisterSchema } from "@hyperjump/json-schema/draft-06";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { componentSpecValidatorQuery } from "./componentSpecValidation";

const schemaUrl =
  "https://raw.githubusercontent.com/Cloud-Pipelines/component_spec_schema/refs/heads/master/component_spec.json_schema.json";

const schema = {
  $schema: "http://json-schema.org/draft-06/schema#",
  $id: schemaUrl,
  allOf: [{ $ref: "#/definitions/ComponentSpec" }],
  definitions: {
    ComponentSpec: {
      type: "object",
      required: ["implementation"],
      properties: {
        inputs: {
          type: "array",
          items: {
            type: "object",
            properties: { default: { type: "string" } },
          },
        },
        implementation: {
          oneOf: [
            {
              type: "object",
              required: ["container"],
              properties: {
                container: {
                  type: "object",
                  required: ["image"],
                  properties: {
                    image: { type: "string" },
                    command: {
                      type: "array",
                      items: {
                        oneOf: [
                          { type: "string" },
                          {
                            type: "object",
                            required: ["if"],
                            properties: {
                              if: {
                                type: "object",
                                required: ["cond", "then"],
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
            {
              type: "object",
              required: ["graph"],
              properties: {
                graph: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "object",
                      additionalProperties: {
                        type: "object",
                        properties: {
                          componentRef: {
                            type: "object",
                            properties: {
                              spec: { $ref: "#/definitions/ComponentSpec" },
                            },
                          },
                          arguments: {
                            type: "object",
                            additionalProperties: {
                              $ref: "#/definitions/ArgumentType",
                            },
                          },
                          isEnabled: { $ref: "#/definitions/PredicateType" },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
    GraphInputArgument: { type: "object", required: ["graphInput"] },
    TaskOutputArgument: { type: "object", required: ["taskOutput"] },
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => structuredClone(schema),
    }),
  );
});

afterEach(() => {
  unregisterSchema(schemaUrl);
  vi.unstubAllGlobals();
});

it.each([10, 5, 1000, false])(
  "explains an unquoted default %s",
  async (value) => {
    const validate = await componentSpecValidatorQuery.queryFn();
    expect(
      validate({
        inputs: [{ name: "limit", default: value }],
        implementation: { container: { image: "python:3.12" } },
      }),
    ).toEqual({
      valid: false,
      errors: [
        "inputs[0].default: Expected a string. Quote numeric and boolean defaults.",
      ],
    });
  },
);

it("explains misindented conditionals without unrelated union failures", async () => {
  const validate = await componentSpecValidatorQuery.queryFn();
  const result = validate(`
name: Search
implementation:
  container:
    image: python:3.12
    command:
      - if:
        cond: {isPresent: queries}
        then: [--queries, {inputValue: queries}]
`);
  expect(result).toEqual({
    valid: false,
    errors: [
      "implementation.container.command[0].if: Expected an object. Indent cond and then beneath if.",
    ],
  });
});

it("validates embedded components while accepting secret and dynamic arguments", async () => {
  const validate = await componentSpecValidatorQuery.queryFn();
  const component = {
    inputs: [{ name: "limit", default: "10" }],
    implementation: { container: { image: "python:3.12" } },
  };
  const graph = {
    implementation: {
      graph: {
        tasks: {
          Search: {
            componentRef: { spec: component },
            arguments: {
              token: { dynamicData: { secret: { name: "example-token" } } },
              run: { dynamicData: "pipeline_run_id" },
            },
            isEnabled: "true",
          },
        },
      },
    },
  };
  expect(validate(graph)).toEqual({ valid: true });
  expect(
    validate(JSON.stringify(graph).replace('"default":"10"', '"default":10'))
      .valid,
  ).toBe(false);
});

it("reports YAML syntax errors", async () => {
  const validate = await componentSpecValidatorQuery.queryFn();
  expect(validate("inputs: [")).toMatchObject({ valid: false });
});

it("reports an empty component definition", async () => {
  const validate = await componentSpecValidatorQuery.queryFn();
  expect(validate("")).toEqual({
    valid: false,
    errors: [expect.stringMatching(/empty/)],
  });
});

it("allows retrying when the schema cannot be loaded", async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
  await expect(componentSpecValidatorQuery.queryFn()).rejects.toThrow(
    "Offline",
  );
  const validate = await componentSpecValidatorQuery.queryFn();
  expect(
    validate({ implementation: { container: { image: "python:3.12" } } }),
  ).toEqual({ valid: true });
});

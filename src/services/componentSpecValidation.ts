import {
  hasSchema,
  type OutputUnit,
  registerSchema,
  type SchemaObject,
  validate,
  type Validator,
} from "@hyperjump/json-schema/draft-06";
import * as yaml from "js-yaml";

import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

const COMPONENT_SPEC_SCHEMA_URL =
  "https://raw.githubusercontent.com/Cloud-Pipelines/component_spec_schema/refs/heads/master/component_spec.json_schema.json";

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export const componentSpecValidatorQuery = {
  queryKey: ["componentSpecValidator"],
  staleTime: Infinity,
  retry: false,
  queryFn: async () => {
    if (!hasSchema(COMPONENT_SPEC_SCHEMA_URL)) {
      const response = await fetch(COMPONENT_SPEC_SCHEMA_URL);
      if (!response.ok) throw new Error("Failed to load component schema");
      const schema: SchemaObject = await response.json();
      const definitions = schema.definitions;
      if (
        !definitions ||
        typeof definitions !== "object" ||
        Array.isArray(definitions)
      ) {
        throw new Error("Invalid component schema");
      }

      // The upstream schema predates dynamic data and argument-based task conditions.
      definitions.ArgumentType = {
        oneOf: [
          { type: "string" },
          { $ref: "#/definitions/GraphInputArgument" },
          { $ref: "#/definitions/TaskOutputArgument" },
          {
            type: "object",
            required: ["dynamicData"],
            properties: {
              dynamicData: { type: ["string", "object"] },
            },
            additionalProperties: false,
          },
        ],
      };
      definitions.PredicateType = {
        $ref: "#/definitions/ArgumentType",
      };
      registerSchema(schema, COMPONENT_SPEC_SCHEMA_URL);
    }

    const validator = await validate(COMPONENT_SPEC_SCHEMA_URL);

    return (value: unknown): ValidationResult => {
      let parsed: unknown;
      try {
        parsed =
          typeof value === "string"
            ? yaml.load(value, PIPELINE_YAML_LOAD_OPTIONS)
            : value;
      } catch (error) {
        return {
          valid: false,
          errors: [error instanceof Error ? error.message : "Invalid YAML"],
        };
      }

      if (parsed === undefined || parsed === null) {
        return { valid: false, errors: ["The component definition is empty."] };
      }

      const result = validator(parsed as Parameters<Validator>[0], {
        outputFormat: "BASIC",
      });
      return result.valid
        ? { valid: true }
        : { valid: false, errors: formatValidationErrors(result.errors ?? []) };
    };
  },
};

function formatValidationErrors(errors: OutputUnit[]): string[] {
  const relevantErrors = errors.filter(
    (error) =>
      !error.keyword.endsWith("/validate") ||
      !errors.some(
        (other) =>
          other.keyword.endsWith("/type") &&
          other.instanceLocation.startsWith(
            `${error.instanceLocation.slice(0, error.instanceLocation.lastIndexOf("/"))}/`,
          ),
      ),
  );
  const specificErrors = relevantErrors.filter(
    (error) =>
      !relevantErrors.some((other) =>
        other.instanceLocation.startsWith(`${error.instanceLocation}/`),
      ),
  );

  return [
    ...new Set(
      specificErrors.map((error) => {
        const path =
          error.instanceLocation
            .replace(/^#?\//, "")
            .replace(/~1/g, "/")
            .replace(/~0/g, "~")
            .replace(/\/(\d+)(?=\/|$)/g, "[$1]")
            .replace(/\//g, ".") || "component";
        const keyword = error.absoluteKeywordLocation.split("/").pop();
        if (keyword === "type" && path.endsWith(".default")) {
          return `${path}: Expected a string. Quote numeric and boolean defaults.`;
        }
        if (keyword === "type" && path.endsWith(".if")) {
          return `${path}: Expected an object. Indent cond and then beneath if.`;
        }
        if (keyword === "required") return `${path}: Missing a required field.`;
        if (keyword === "additionalProperties") {
          return `${path}: Contains an unsupported field.`;
        }
        if (keyword === "type") return `${path}: Incorrect value type.`;
        return `${path}: Does not match the component format.`;
      }),
    ),
  ];
}
